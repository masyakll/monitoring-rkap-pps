<script lang="ts">
  import { onMount } from 'svelte';
  export let user: { role:'pic'|'viewer'|'admin' };
  type Kind = 'budget'|'gr'|'analisa';
  let data:any=null; let loading=true; let saving=false; let error=''; let message=''; let kind:Kind='budget'; let draft:Record<string,string>={}; let actualColumnPath='';
  onMount(load);
  async function load(){loading=true;error='';try{const res=await fetch('/api/mapping',{cache:'no-store'});const b=await res.json();if(!res.ok)throw new Error(b.error||'Pemetaan gagal dimuat.');data=b;initDraft();}catch(e){error=e instanceof Error?e.message:'Gagal memuat pemetaan.'}finally{loading=false}}
  function initDraft(){if(!data)return;const saved=data.configs?.find((c:any)=>c.importType===kind);draft={...(saved?.mapping??{})};actualColumnPath=saved?.aktualColumnPath??draft.aktualTotal??'';}
  $: fields = data?.defaults?.[kind] ? Object.entries(data.defaults[kind]) as [string,any][] : [];
  async function save(){saving=true;error='';message='';try{const cleaned=Object.fromEntries(Object.entries(draft).filter(([key,value])=>key!=='__proto__'&&key!=='prototype'&&key!=='constructor'&&typeof value==='string'&&value.trim()).map(([key,value])=>[key,value.trim()]));if(kind==='gr'&&actualColumnPath.trim())cleaned.aktualTotal=actualColumnPath.trim();const res=await fetch('/api/mapping',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({importType:kind,mapping:cleaned,aktualColumnPath:kind==='gr'?actualColumnPath.trim():undefined})});const b=await res.json();if(!res.ok)throw new Error(b.error||'Pemetaan gagal disimpan.');message='Pemetaan tersimpan dan akan dipakai pada impor berikutnya.';await load();}catch(e){error=e instanceof Error?e.message:'Gagal menyimpan pemetaan.'}finally{saving=false}}
</script>
<section class="page-title"><div><div class="eyebrow">KONFIGURASI IMPOR</div><h1>Atur Pemetaan Kolom</h1><p>Sesuaikan nama kolom file ekspor ke field standar aplikasi. Perubahan berlaku pada impor berikutnya.</p></div><button class="btn secondary" on:click={load} disabled={loading}>Muat ulang</button></section>
{#if user.role!=='admin'}<div class="notice error">Hanya admin yang dapat mengubah pemetaan kolom.</div>
{:else if loading}<section class="panel empty">Memuat konfigurasi…</section>
{:else if data}
  {#if error}<div class="alert error">{error}</div>{/if}{#if message}<div class="alert success">{message}</div>{/if}
  <section class="panel"><div class="panel-head"><div><h2>Sumber yang dipetakan</h2><p>Gunakan jalur kolom hasil perataan header. Penamaan tidak sensitif huruf besar/kecil.</p></div></div><div class="form-row"><label>Jenis impor<select bind:value={kind} on:change={initDraft}><option value="budget">Anggaran RKAP</option><option value="gr">GR Capex Opex</option><option value="analisa">Analisa Penyerapan (migrasi historis)</option></select></label>{#if kind==='gr'}<label>Kolom nilai Aktual (opsional; default kolom T)<input bind:value={actualColumnPath} placeholder="Contoh: Total GR atau Kolom T"/><small>Pastikan kolom yang dipilih adalah nilai realisasi GR dalam mata uang yang sesuai.</small></label>{/if}</div>
    <div class="table-scroll"><table><thead><tr><th>Field aplikasi</th><th>Nama kolom yang dikenali otomatis</th><th>Kolom aktual di file (opsional untuk override)</th><th>Wajib</th></tr></thead><tbody>
      {#each fields as field}<tr><td><strong>{field[0]}</strong></td><td class="aliases">{(field[1]?.aliases??[]).join(' · ')||'—'}</td><td><input class="mapping-input" bind:value={draft[field[0]]} placeholder="Kosongkan untuk deteksi otomatis" aria-label={`Pemetaan ${field[0]}`}/></td><td>{field[1]?.required?'Ya':'Tidak'}</td></tr>{/each}
    </tbody></table></div>
    <div class="actions"><button class="btn secondary" on:click={()=>{draft={};actualColumnPath='';}}>Kosongkan override</button><button class="btn primary" on:click={save} disabled={saving}>{saving?'Menyimpan…':'Simpan pemetaan'}</button></div>
  </section>
  <section class="panel info-panel"><h2>Petunjuk</h2><ul><li>Kosongkan override untuk memakai alias default otomatis.</li><li>Jika nama kolom ganda, tuliskan jalur lengkap hasil pratinjau, termasuk akhiran <code>#2</code>.</li><li>Untuk data anggaran, field <code>commitmentItem</code> wajib diisi; nilai Plan yang tidak tersedia akan dilaporkan saat pratinjau.</li><li>Untuk GR, jika nama kolom aktual tidak terdeteksi, sistem memakai kolom ke-20 sebagai fallback dan memberi peringatan.</li><li>Data yang tidak cocok jangan dipaksakan; periksa di halaman Rekonsiliasi.</li></ul></section>
{/if}
<style>
  .page-title { display: flex; justify-content: space-between; gap: 1rem; margin-bottom: 1.2rem; }
  .page-title h1 { font-size: 1.65rem; color: #111111; margin: 0.15rem 0 0.35rem; font-weight: 700; letter-spacing: -0.025em; }
  .page-title p, .panel-head p { margin: 0.25rem 0 0; color: #5a5f67; font-size: 0.88rem; }
  .eyebrow { font-size: 0.72rem; letter-spacing: 0.08em; font-weight: 700; color: #5a5f67; text-transform: uppercase; }
  .panel { background: white; border: 1px solid #eaeaea; border-radius: 12px; margin-bottom: 1rem; min-width: 0; box-shadow: 0 1px 3px rgba(0,0,0,0.02); }
  .panel-head { padding: 1rem 1.1rem; border-bottom: 1px solid #eaeaea; }
  .panel-head h2, .info-panel h2 { margin: 0; color: #111111; font-size: 1rem; font-weight: 700; }
  .form-row { display: flex; gap: 1rem; padding: 1rem 1.1rem; align-items: flex-start; }
  .form-row label { display: flex; flex-direction: column; gap: 0.35rem; color: #333333; font-size: 0.8rem; font-weight: 650; min-width: 280px; flex: 1; }
  .form-row input, .form-row select, .mapping-input { font: inherit; border: 1px solid #d8dbe0; padding: 0.55rem 0.65rem; border-radius: 8px; background: white; color: #111111; }
  .form-row small { color: #8c929c; font-weight: 400; }
  .table-scroll { overflow: auto; }
  .table-scroll table { width: 100%; border-collapse: collapse; font-size: 0.79rem; }
  .table-scroll th { background: #f8f9fa; color: #5a5f67; text-align: left; white-space: nowrap; font-weight: 700; padding: 0.6rem 0.7rem; border-bottom: 1px solid #eaeaea; }
  .table-scroll td { padding: 0.6rem 0.7rem; border-bottom: 1px solid #f1f3f5; vertical-align: top; }
  .aliases { min-width: 300px; color: #5a5f67; line-height: 1.45; }
  .mapping-input { min-width: 240px; width: 100%; }
  .actions { display: flex; justify-content: flex-end; gap: 0.5rem; padding: 1rem 1.1rem; }
  .btn { font: inherit; font-size: 0.82rem; font-weight: 600; border-radius: 8px; padding: 0.6rem 0.85rem; cursor: pointer; border: 1px solid transparent; transition: all 0.16s ease; }
  .btn:disabled { opacity: 0.55; cursor: not-allowed; }
  .btn.primary { background: #111111; color: white; }
  .btn.primary:hover:not(:disabled) { background: #23252b; }
  .btn.secondary { background: white; border-color: #d8dbe0; color: #111111; }
  .btn.secondary:hover:not(:disabled) { background: #f8f9fa; }
  .notice { padding: 0.8rem 1rem; border: 1px solid #e5e7eb; background: #f8f9fa; border-left: 3px solid #111111; color: #333333; border-radius: 8px; }
  .notice.error { background: #fef2f2; border-color: #fecaca; border-left-color: #dc2626; color: #991b1b; }
  .alert { padding: 0.7rem 0.85rem; border-radius: 8px; margin: 0.75rem 0; }
  .alert.error { background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; }
  .alert.success { background: #f8fafc; border: 1px solid #cbd5e1; color: #0f172a; font-weight: 600; }
  .info-panel { padding: 1rem 1.1rem; }
  .info-panel ul { margin: 0.75rem 0 0; padding-left: 1.25rem; color: #5a5f67; font-size: 0.82rem; line-height: 1.7; }
  .empty { padding: 1.3rem; text-align: center; color: #8c929c; }
  @media (max-width: 700px) { .page-title { flex-direction: column; } .form-row { flex-direction: column; } .form-row label { min-width: 0; width: 100%; } }
</style>
