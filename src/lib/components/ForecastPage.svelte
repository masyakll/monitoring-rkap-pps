<script lang="ts">
  import { onMount } from 'svelte';
  export let user: { role:'pic'|'viewer'|'admin' };
  const months=[{key:'jan',label:'Januari'},{key:'feb',label:'Februari'},{key:'mar',label:'Maret'},{key:'apr',label:'April'},{key:'mei',label:'Mei'},{key:'jun',label:'Juni'},{key:'jul',label:'Juli'},{key:'agu',label:'Agustus'},{key:'sep',label:'September'},{key:'okt',label:'Oktober'},{key:'nov',label:'November'},{key:'des',label:'Desember'}];
  type Row={jobId:string;no:number;title:string;pic:string;tipe:'CAPEX'|'OPEX';planUsd:number|null;grMonthly:Record<string,number|null>|null};
  type Version={id:string;version:number;jobId:string;keterangan:string;monthly:Record<string,number|null>;totalUsd:number|null;pct:number|null;tipe:'CAPEX'|'OPEX'|'';lockedAt:string;lockedBy:string;unlockedAt:string|null;unlockedBy:string|null;unlockedReason:string|null};
  let rows:Row[]=[];let versions:Version[]=[];let selectedJobId='';let values:Record<string,string>={};let keterangan='';let unlockReason='';let loading=true;let saving=false;let error='';let message='';let search='';
  const money=(v:number|null|undefined)=>v==null?'—':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(v);
  const pct=(v:number|null|undefined)=>v==null?'—':`${(v*100).toFixed(1).replace('.',',')}%`;
  $: filteredRows=rows.filter(r=>!search||`${r.title} ${r.pic} ${r.no}`.toLowerCase().includes(search.toLowerCase()));
  $: selected=rows.find(r=>r.jobId===selectedJobId)??null;
  $: ownVersions=versions.filter(v=>v.jobId===selectedJobId).sort((a,b)=>b.version-a.version);
  $: latest=ownVersions[0]??null;
  $: editable=user.role==='admin' && (!latest || !!latest.unlockedAt);
  $: totalForecast=months.every(m=>values[m.key]!==undefined && values[m.key] !== '') ? months.reduce((s,m)=>s+Number(values[m.key]||0),0) : null;
  $: currentPlan=selected?.planUsd ?? null;
  $: totalPct=currentPlan!=null && currentPlan>0 && totalForecast!=null ? totalForecast/currentPlan : null;
  function totalDelta(v:Version){const prior=ownVersions.find(p=>p.version===v.version-1);return prior?.totalUsd==null||v.totalUsd==null?null:v.totalUsd-prior.totalUsd;}
  const deltaMoney=(v:number|null)=>v==null?'—':`${v>0?'+':''}${new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(v)}`;
  onMount(loadAll);
  async function loadAll(keepSelection=true){loading=true;error='';try{const [a,p]=await Promise.all([fetch('/api/analysis',{cache:'no-store'}),fetch('/api/prognosa',{cache:'no-store'})]);const ab=await a.json();const pb=await p.json();if(!a.ok)throw new Error(ab.error||'Analisa gagal dimuat.');if(!p.ok)throw new Error(pb.error||'Versi Prognosa gagal dimuat.');rows=(ab.rows??[]).map((r:any)=>({jobId:r.jobId,no:r.no,title:r.title,pic:r.pic,tipe:r.tipe,planUsd:r.planUsd,grMonthly:r.grMonthly}));versions=pb.versions??[];if(!keepSelection||!selectedJobId)selectedJobId=rows[0]?.jobId??'';setValuesFromCurrent();}catch(e){error=e instanceof Error?e.message:'Gagal memuat data Prognosa.'}finally{loading=false}}
  function setValuesFromCurrent(){const row=rows.find(r=>r.jobId===selectedJobId);const v=versions.filter(x=>x.jobId===selectedJobId).sort((a,b)=>b.version-a.version)[0];const next:Record<string,string>={};for(let i=0;i<months.length;i++){const m=months[i];let val:number|null=null;if(i<8 && (!v || v.unlockedAt)) val=row?.grMonthly?.[m.key]??null; else if(v) val=v.monthly?.[m.key]??null; else val=null;next[m.key]=val==null?'':String(val);}values=next;keterangan=v?.keterangan??'';unlockReason='';message='';}
  function selectJob(id:string){selectedJobId=id;setValuesFromCurrent();}
  async function unlock(){if(!latest||!unlockReason.trim()){error='Isi alasan membuka kunci terlebih dahulu.';return;}saving=true;error='';message='';try{const res=await fetch('/api/prognosa',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({jobId:selectedJobId,version:latest.version,reason:unlockReason})});const b=await res.json();if(!res.ok)throw new Error(b.error||'Versi tidak dapat dibuka.');message=`Versi v${latest.version} dibuka untuk revisi. Simpan sebagai versi baru setelah perubahan selesai.`;await loadAll();}catch(e){error=e instanceof Error?e.message:'Gagal membuka kunci.'}finally{saving=false}}
  async function lockNewVersion(){if(!selectedJobId){error='Pilih pekerjaan terlebih dahulu.';return;}if(!keterangan.trim()){error='Isi keterangan tanggal penyampaian ke Prodiv.';return;}for(const m of months.slice(8)){if(values[m.key]===''||!Number.isFinite(Number(values[m.key]))||Number(values[m.key])<0){error=`Isi perkiraan ${m.label} dengan angka nol atau lebih.`;return;}}
    saving=true;error='';message='';try{const monthly=Object.fromEntries(months.map(m=>[m.key,values[m.key]===''?null:Number(values[m.key])]));const res=await fetch('/api/prognosa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jobId:selectedJobId,monthly,keterangan:keterangan.trim()})});const b=await res.json();if(!res.ok)throw new Error(b.error||'Prognosa tidak dapat dikunci.');message=`Prognosa v${b.version.version} tersimpan dan terkunci.`;await loadAll();}catch(e){error=e instanceof Error?e.message:'Gagal menyimpan Prognosa.'}finally{saving=false}}
</script>
<section class="page-title"><div><div class="eyebrow">PERENCANAAN AKHIR TAHUN</div><h1>Prognosa RKAP</h1><p>Snapshot tahunan berversi. Perubahan tidak menimpa versi terdahulu.</p></div><button class="btn secondary" on:click={()=>loadAll()} disabled={loading}>Muat ulang</button></section>
<div class="notice"><strong>Metode:</strong> Prognosa tahunan = Aktual GR Januari–Agustus + perkiraan September–Desember. Januari–Agustus dikunci mengikuti data GR yang diimpor. Setelah disampaikan ke Prodiv, snapshot dikunci dan hanya admin yang dapat membukanya dengan alasan yang tercatat.</div>
{#if error}<div class="alert error" role="alert">{error}</div>{/if}{#if message}<div class="alert success" role="status">{message}</div>{/if}
{#if loading}<section class="panel empty">Memuat versi Prognosa…</section>
{:else}
  <div class="forecast-layout">
    <section class="panel job-list"><div class="panel-head"><div><h2>Pilih pekerjaan</h2><p>Versi Prognosa tersimpan per pekerjaan.</p></div></div><div class="list-search"><input bind:value={search} placeholder="Cari pekerjaan…" aria-label="Cari pekerjaan"/></div><div class="jobs">{#each filteredRows as row}<button class:active={selectedJobId===row.jobId} class="job-option" on:click={()=>selectJob(row.jobId)}><span class="job-option-title">{row.title}</span><small>{row.tipe} · {row.pic}</small><span class="job-option-status">{#if versions.some(v=>v.jobId===row.jobId&&!v.unlockedAt)}Terkunci{:else if versions.some(v=>v.jobId===row.jobId)}Terbuka untuk revisi{:else}Belum ada versi{/if}</span></button>{/each}</div></section>
    <section class="panel forecast-editor"><div class="panel-head"><div><h2>{selected?.title??'Pilih pekerjaan'}</h2><p>{selected?`${selected.tipe} · PIC ${selected.pic} · Plan RKAP ${money(selected.planUsd)}`:'Pilih pekerjaan di daftar sebelah kiri.'}</p></div>{#if latest}<span class:locked={!latest.unlockedAt} class:open={!!latest.unlockedAt} class="state-tag">{latest.unlockedAt?'Terbuka untuk revisi':`Terkunci · v${latest.version}`}</span>{:else}<span class="state-tag">Belum ada versi</span>{/if}</div>
      {#if selected}
        <div class="version-meta"><label>Keterangan penyampaian ke Prodiv<input bind:value={keterangan} maxlength="500" placeholder="Contoh: Disampaikan ke Prodiv pada 14 Oktober 2026" disabled={!editable}/></label><div class="summary-numbers"><div><span>Prognosa tahunan</span><strong>{money(totalForecast)}</strong></div><div><span>Terhadap Plan</span><strong>{pct(totalPct)}</strong></div></div></div>
        <div class="month-grid">{#each months as m,i}<label class:actual-month={i<8} class="month-field"><span>{m.label}{#if i<8}<small>Aktual GR</small>{:else}<small>Perkiraan</small>{/if}</span><input type="number" min="0" step="0.01" bind:value={values[m.key]} disabled={i<8||!editable} placeholder={i<8?'Belum ada GR':'0.00'}/></label>{/each}</div>
        <div class="lock-note">{#if latest&&!latest.unlockedAt}Versi ini terkunci sejak {new Date(latest.lockedAt).toLocaleString('id-ID')} oleh {latest.lockedBy}. Semua peran melihat nilai ini dalam keadaan baca saja.{:else if latest?.unlockedAt}Dibuka oleh {latest.unlockedBy} pada {new Date(latest.unlockedAt).toLocaleString('id-ID')}. Alasan: {latest.unlockedReason}. Setelah selesai, simpan sebagai versi baru.{:else}Belum ada snapshot. Hanya admin yang dapat membuat versi pertama.{/if}</div>
        {#if user.role==='admin'}
          {#if latest&&!latest.unlockedAt}<div class="unlock-box"><label>Alasan membuka kunci versi terbaru<input bind:value={unlockReason} maxlength="500" placeholder="Wajib diisi, misalnya revisi proyeksi biaya material"/></label><button class="btn secondary" on:click={unlock} disabled={saving||!unlockReason.trim()}>{saving?'Memproses…':'Buka kunci'}</button></div>{/if}
          {#if !latest||!!latest.unlockedAt}<div class="bottom-actions"><span class="muted">Saat dikunci, nilai Jan–Agu diambil ulang dari GR terbaru.</span><button class="btn primary" on:click={lockNewVersion} disabled={saving}>{saving?'Menyimpan…':'Kunci sebagai versi baru'}</button></div>{/if}
        {/if}
      {/if}
    </section>
  </div>
  {#if selected}
    <section class="panel history-panel"><div class="panel-head"><div><h2>Riwayat versi</h2><p>Versi lama dipertahankan untuk audit dan perbandingan.</p></div></div><div class="table-scroll"><table><thead><tr><th>Versi</th><th>Keterangan</th><th>Total (USD)</th><th>% Plan</th><th>Selisih vs versi sebelumnya</th><th>Dibuat oleh</th><th>Status</th><th>Catatan buka kunci</th></tr></thead><tbody>{#each ownVersions as v}<tr><td>v{v.version}</td><td>{v.keterangan}</td><td>{money(v.totalUsd)}</td><td>{pct(v.pct)}</td><td>{v.version===1?'—':deltaMoney(totalDelta(v))}</td><td>{v.lockedBy}<small>{new Date(v.lockedAt).toLocaleDateString('id-ID')}</small></td><td><span class:locked={!v.unlockedAt} class:open={!!v.unlockedAt} class="state-tag">{v.unlockedAt?'Dibuka':'Terkunci'}</span></td><td>{v.unlockedReason||'—'}</td></tr>{/each}{#if !ownVersions.length}<tr><td colspan="8" class="empty">Belum ada versi Prognosa.</td></tr>{/if}</tbody></table></div></section>
  {/if}
{/if}
<style>
.page-title { display: flex; justify-content: space-between; gap: 1rem; margin-bottom: 1.2rem; }
.page-title h1 { font-size: 1.65rem; color: #111111; margin: 0.15rem 0 0.35rem; font-weight: 700; letter-spacing: -0.025em; }
.page-title p, .panel-head p { margin: 0.25rem 0 0; color: #5a5f67; font-size: 0.88rem; }
.eyebrow { font-size: 0.72rem; letter-spacing: 0.08em; font-weight: 700; color: #5a5f67; text-transform: uppercase; }
.notice { padding: 0.9rem 1rem; border: 1px solid #e5e7eb; border-left: 3px solid #111111; background: #f8f9fa; border-radius: 8px; color: #333333; margin: 0 0 1rem; line-height: 1.5; font-size: 0.88rem; }
.panel { background: white; border: 1px solid #eaeaea; border-radius: 12px; margin-bottom: 1rem; min-width: 0; box-shadow: 0 1px 3px rgba(0,0,0,0.02); }
.panel-head { display: flex; justify-content: space-between; gap: 1rem; align-items: flex-start; padding: 1rem 1.1rem; border-bottom: 1px solid #eaeaea; }
.panel-head h2 { margin: 0; font-size: 1rem; color: #111111; font-weight: 700; }
.forecast-layout { display: grid; grid-template-columns: minmax(245px, 0.75fr) minmax(0, 2fr); gap: 1rem; }
.jobs { max-height: 560px; overflow: auto; }
.list-search { padding: 0.7rem; border-bottom: 1px solid #eaeaea; }
.list-search input { width: 100%; font: inherit; padding: 0.55rem; border: 1px solid #d8dbe0; border-radius: 8px; }
.job-option { display: block; width: 100%; text-align: left; padding: 0.75rem 0.85rem; background: white; border: 0; border-bottom: 1px solid #f1f3f5; border-left: 3px solid transparent; cursor: pointer; transition: all 0.16s ease; }
.job-option:hover { background: #f8fafc; }
.job-option.active { background: #f1f5f9; border-left-color: #111111; }
.job-option-title, .job-option small, .job-option-status { display: block; }
.job-option-title { font-size: 0.83rem; font-weight: 650; color: #111111; line-height: 1.4; }
.job-option small { font-size: 0.75rem; color: #5a5f67; margin-top: 0.2rem; }
.job-option-status { font-size: 0.71rem; color: #8c929c; margin-top: 0.3rem; }
.state-tag { display: inline-flex; padding: 0.3rem 0.6rem; border-radius: 6px; border: 1px solid #d8dbe0; background: #f8f9fa; color: #333333; white-space: nowrap; font-size: 0.74rem; font-weight: 600; }
.state-tag.locked { background: #f1f5f9; color: #475569; }
.state-tag.open { background: #fffbeb; border-color: #fde68a; color: #92400e; }
.version-meta { padding: 1rem 1.1rem; display: grid; grid-template-columns: minmax(200px, 1.3fr) minmax(260px, 1fr); gap: 1rem; }
.version-meta label, .unlock-box label { display: flex; flex-direction: column; gap: 0.35rem; font-size: 0.8rem; font-weight: 650; color: #333333; }
.version-meta input, .unlock-box input { font: inherit; border: 1px solid #d8dbe0; border-radius: 8px; padding: 0.6rem; }
.summary-numbers { display: grid; grid-template-columns: 1fr 1fr; gap: 0.65rem; }
.summary-numbers div { background: #f8f9fa; border: 1px solid #eaeaea; border-radius: 8px; padding: 0.6rem 0.75rem; }
.summary-numbers span, .summary-numbers strong { display: block; }
.summary-numbers span { font-size: 0.72rem; color: #5a5f67; }
.summary-numbers strong { font-size: 1.1rem; margin-top: 0.25rem; color: #111111; font-weight: 800; }
.month-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.65rem; padding: 0 1.1rem 1rem; }
.month-field { display: block; border: 1px solid #eaeaea; background: #fff; padding: 0.65rem; border-radius: 8px; }
.month-field.actual-month { background: #f8f9fa; }
.month-field > span { display: flex; flex-direction: column; gap: 0.1rem; font-weight: 650; font-size: 0.8rem; color: #111111; }
.month-field small { font-weight: 400; color: #8c929c; font-size: 0.7rem; }
.month-field input { display: block; box-sizing: border-box; width: 100%; font: inherit; margin-top: 0.45rem; padding: 0.5rem; border: 1px solid #d8dbe0; border-radius: 6px; font-variant-numeric: tabular-nums; }
.month-field input:disabled { background: #f1f5f9; color: #64748b; }
.lock-note { padding: 0.8rem 1.1rem; background: #f8f9fa; border-top: 1px solid #eaeaea; color: #5a5f67; font-size: 0.79rem; line-height: 1.5; }
.unlock-box { display: flex; gap: 0.75rem; align-items: flex-end; padding: 1rem 1.1rem; border-top: 1px solid #eaeaea; }
.unlock-box label { flex: 1; }
.btn { font: inherit; font-size: 0.82rem; font-weight: 600; border-radius: 8px; padding: 0.6rem 0.85rem; cursor: pointer; border: 1px solid transparent; white-space: nowrap; transition: all 0.16s ease; }
.btn.primary { background: #111111; color: #fff; }
.btn.primary:hover:not(:disabled) { background: #23252b; }
.btn.secondary { background: #fff; border-color: #d8dbe0; color: #111111; }
.btn.secondary:hover:not(:disabled) { background: #f8f9fa; }
.btn:disabled { opacity: 0.55; cursor: not-allowed; }
.bottom-actions { display: flex; justify-content: space-between; align-items: center; gap: 1rem; padding: 1rem 1.1rem; border-top: 1px solid #eaeaea; }
.muted { font-size: 0.75rem; color: #8c929c; }
.history-panel .table-scroll { overflow: auto; }
.history-panel table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
.history-panel th { background: #f8f9fa; text-align: left; color: #5a5f67; white-space: nowrap; font-weight: 700; padding: 0.6rem 0.7rem; border-bottom: 1px solid #eaeaea; }
.history-panel td { padding: 0.6rem 0.7rem; border-bottom: 1px solid #f1f3f5; vertical-align: top; }
.history-panel td small { display: block; color: #8c929c; margin-top: 0.2rem; }
.empty { padding: 1rem; text-align: center; color: #8c929c; }
.alert { padding: 0.7rem 0.85rem; border-radius: 8px; margin: 0.75rem 0; }
.alert.error { background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; }
.alert.success { background: #f8fafc; border: 1px solid #cbd5e1; color: #0f172a; font-weight: 600; }
@media (max-width: 1050px) { .forecast-layout { grid-template-columns: 1fr; } .jobs { max-height: 260px; } .month-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } .version-meta { grid-template-columns: 1fr; } }
@media (max-width: 640px) { .page-title { flex-direction: column; } .month-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .unlock-box, .bottom-actions { align-items: stretch; flex-direction: column; } }
</style>
