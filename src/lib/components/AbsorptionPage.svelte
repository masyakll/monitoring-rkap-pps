<script lang="ts">
  import { onMount } from 'svelte';

  type Payload = {
    connected: boolean;
    message?: string;
    headers: string[];
    rows: string[][];
    fetchedAt: string | null;
    error?: string;
  };

  export let canRefresh = false;

  let payload: Payload = { connected: false, headers: [], rows: [], fetchedAt: null, message: 'Memeriksa sumber data…' };
  let loading = true;
  let refreshing = false;
  let query = '';
  let errorMessage = '';
  let filteredRows: string[][] = [];
  let displayRows: string[][] = [];

  $: filteredRows = (payload.rows || []).filter((row) => !query.trim() || row.join(' ').toLowerCase().includes(query.trim().toLowerCase()));
  $: displayRows = filteredRows.slice(0, 250);

  onMount(() => { void load(false); });

  async function load(force: boolean) {
    if (force) refreshing = true;
    else loading = true;
    errorMessage = '';
    try {
      const response = force
        ? await fetch('/api/absorption', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
        : await fetch('/api/absorption', { cache: 'no-store' });
      const result = await response.json() as Partial<Payload> & { error?: string };
      if (!response.ok) {
        errorMessage = result.error || 'Sumber data tidak dapat dibaca.';
        if (Array.isArray(result.headers) && Array.isArray(result.rows)) payload = result as Payload;
        return;
      }
      payload = {
        connected: Boolean(result.connected), headers: Array.isArray(result.headers) ? result.headers : [],
        rows: Array.isArray(result.rows) ? result.rows : [], fetchedAt: result.fetchedAt || null,
        message: result.message || '', error: result.error
      };
    } catch {
      errorMessage = 'Tidak dapat menghubungi server untuk membaca data penyerapan.';
      payload = { connected: false, headers: [], rows: [], fetchedAt: null, message: errorMessage };
    } finally {
      loading = false;
      refreshing = false;
    }
  }

  function syncedAt(value: string | null) {
    if (!value) return 'Belum ada';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(date) + ' WIB';
  }
</script>

<section class="abs-page">
  <div class="abs-heading">
    <div>
      <div class="eyebrow">SUMBER PENYERAPAN</div>
      <h1>Penyerapan RKAP &amp; GR/IR</h1>
      <p>Data dibaca dari sheet penyerapan yang disiapkan mentor. Dashboard ini hanya membaca sumber dan tidak mengubah isi spreadsheet.</p>
    </div>
    {#if canRefresh}
      <button class="btn primary" on:click={() => load(true)} disabled={refreshing || loading}>
        {refreshing ? 'Menyegarkan…' : 'Refresh data'}
      </button>
    {/if}
  </div>

  {#if errorMessage}
    <div class="abs-alert error" role="alert">{errorMessage}</div>
  {/if}

  <div class="abs-kpis">
    <article><span>Status sumber</span><strong class:good={payload.connected}>{payload.connected ? 'Terhubung' : 'Belum terhubung'}</strong><small>{payload.connected ? 'Sheet berhasil dibaca' : 'Perlu konfigurasi sumber data'}</small></article>
    <article><span>Baris data</span><strong>{loading ? '…' : (payload.rows || []).length.toLocaleString('id-ID')}</strong><small>Baris setelah header</small></article>
    <article><span>Kolom</span><strong>{loading ? '…' : (payload.headers || []).length.toLocaleString('id-ID')}</strong><small>Header dibaca dari sheet</small></article>
    <article><span>Terakhir dibaca</span><strong class="timestamp">{syncedAt(payload.fetchedAt)}</strong><small>Waktu baca dari server</small></article>
  </div>

  <section class="abs-panel">
    <div class="abs-panel-heading">
      <div>
        <h2>Data penyerapan</h2>
        <p>{payload.message || 'Tabel mengikuti header pada sheet sumber.'}</p>
      </div>
      {#if (payload.rows || []).length > 0}
        <label class="abs-search"><span>Cari</span><input bind:value={query} placeholder="Cari pekerjaan atau nilai…" aria-label="Cari data penyerapan" /></label>
      {/if}
    </div>

    {#if loading}
      <div class="abs-empty">Sedang membaca sumber data…</div>
    {:else if !payload.connected || (payload.headers || []).length === 0}
      <div class="abs-empty">
        <div class="empty-mark">↗</div>
        <h3>Sumber penyerapan belum tersedia</h3>
        <p>Tab ini akan menampilkan data setelah ID spreadsheet, akses baca, dan range sheet dari mentor dikonfigurasi. Belum ada angka penyerapan yang ditampilkan agar dashboard tidak memakai angka dummy seolah-olah data aktual.</p>
      </div>
    {:else if displayRows.length === 0}
      <div class="abs-empty">Tidak ada baris yang cocok dengan pencarian.</div>
    {:else}
      <div class="abs-table-wrap">
        <table class="abs-table">
          <thead><tr>{#each (payload.headers || []) as header}<th>{header}</th>{/each}</tr></thead>
          <tbody>
            {#each displayRows as row, rowIndex (rowIndex)}
              <tr>{#each (payload.headers || []) as _, colIndex (colIndex)}<td>{row[colIndex] || '—'}</td>{/each}</tr>
            {/each}
          </tbody>
        </table>
      </div>
      <div class="abs-table-foot">Menampilkan {displayRows.length.toLocaleString('id-ID')} dari {filteredRows.length.toLocaleString('id-ID')} baris hasil filter. {#if filteredRows.length > displayRows.length}Batasi pencarian untuk melihat baris tertentu.{/if}</div>
    {/if}
  </section>

  <p class="abs-note"><strong>Catatan:</strong> total GR, IR, atau persentase penyerapan baru boleh dihitung setelah mentor menetapkan kolom dan definisi resminya. Nama kolom tidak ditebak otomatis agar angka yang ditampilkan tidak salah makna.</p>
</section>

<style>
  .abs-page { display: grid; gap: 18px; color: #111111; }
  .abs-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
  .abs-heading h1 { font-size: clamp(22px, 2vw, 28px); margin: 5px 0 7px; font-weight: 700; letter-spacing: -0.025em; color: #111111; }
  .abs-heading p, .abs-panel-heading p { margin: 0; color: #5a5f67; max-width: 780px; line-height: 1.55; font-size: 13px; }
  .eyebrow { font-size: 11px; letter-spacing: 0.08em; font-weight: 700; color: #5a5f67; text-transform: uppercase; }
  .abs-kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
  .abs-kpis article { border: 1px solid #eaeaea; background: #fff; border-radius: 12px; padding: 16px; display: grid; gap: 6px; min-width: 0; box-shadow: 0 1px 3px rgba(0,0,0,0.02); }
  .abs-kpis span { font-size: 12px; color: #5a5f67; }
  .abs-kpis strong { font-size: 22px; font-weight: 800; color: #111111; overflow-wrap: anywhere; }
  .abs-kpis strong.good { color: #2563eb; }
  .abs-kpis strong.timestamp { font-size: 13px; line-height: 1.4; }
  .abs-kpis small { font-size: 11px; color: #8c929c; }
  .abs-panel { border: 1px solid #eaeaea; border-radius: 14px; background: white; overflow: hidden; min-width: 0; box-shadow: 0 1px 3px rgba(0,0,0,0.02); }
  .abs-panel-heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; padding: 16px 18px; border-bottom: 1px solid #eaeaea; }
  .abs-panel-heading h2 { margin: 0 0 5px; font-size: 16px; font-weight: 700; color: #111111; }
  .abs-search { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #5a5f67; min-width: 240px; }
  .abs-search input { width: 100%; border: 1px solid #d8dbe0; border-radius: 8px; padding: 8px 12px; font: inherit; color: #111111; }
  .abs-table-wrap { overflow: auto; max-height: 65vh; }
  .abs-table { border-collapse: separate; border-spacing: 0; width: 100%; font-size: 12px; white-space: nowrap; }
  .abs-table th { position: sticky; top: 0; background: #f8f9fa; color: #5a5f67; text-align: left; font-size: 11px; font-weight: 700; padding: 11px 14px; border-bottom: 1px solid #eaeaea; }
  .abs-table td { padding: 10px 14px; border-bottom: 1px solid #f1f3f5; max-width: 360px; overflow: hidden; text-overflow: ellipsis; color: #333333; }
  .abs-table tbody tr:hover { background: #f8fafc; }
  .abs-table-foot { font-size: 12px; color: #8c929c; padding: 12px 16px; }
  .abs-empty { padding: 44px 22px; text-align: center; color: #8c929c; line-height: 1.65; font-size: 13px; }
  .abs-empty h3 { margin: 8px 0; color: #111111; font-size: 17px; font-weight: 700; }
  .abs-empty p { max-width: 620px; margin: 0 auto; }
  .empty-mark { display: grid; place-items: center; width: 42px; height: 42px; margin: 0 auto; border-radius: 12px; background: #f1f5f9; color: #475569; font-size: 20px; }
  .abs-alert { border-radius: 8px; padding: 12px 14px; font-size: 13px; }
  .abs-alert.error { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
  .abs-note { margin: 0; color: #5a5f67; font-size: 12px; line-height: 1.6; }
  .abs-note strong { color: #111111; }
  @media (max-width: 900px) { .abs-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); } .abs-heading, .abs-panel-heading { align-items: stretch; flex-direction: column; } .abs-search { min-width: 0; } }
  @media (max-width: 520px) { .abs-kpis { grid-template-columns: 1fr 1fr; } .abs-kpis article { padding: 11px; } .abs-kpis strong { font-size: 18px; } }
</style>
