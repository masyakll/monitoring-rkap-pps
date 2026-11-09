<script lang="ts">
  // Placeholder only. The Google Sheets connection is not activated on this page.
</script>

<section class="integration-page">
  <header class="integration-heading">
    <div>
      <div class="eyebrow">PENGATURAN SUMBER DATA</div>
      <h1>Integrasi Google Sheets</h1>
      <p>Area ini disiapkan untuk menghubungkan dashboard ke file Google Sheets yang akan disepakati bersama mentor. Koneksi belum diaktifkan.</p>
    </div>
    <span class="status-pill pending"><span class="status-dot"></span>Belum terhubung</span>
  </header>

  <section class="integration-panel">
    <div class="panel-heading">
      <div>
        <h2>Ruang konfigurasi spreadsheet</h2>
        <p>Kolom di bawah merupakan placeholder. Akan diisi setelah file sumber dan nama tab dikonfirmasi. Belum ada data yang dibaca atau disimpan dari halaman ini.</p>
      </div>
      <span class="read-only-tag">Belum aktif</span>
    </div>

    <div class="integration-form">
      <label class="field field-wide">
        <span>Link Google Sheets</span>
        <input type="url" disabled placeholder="Link spreadsheet akan ditambahkan di tahap integrasi" />
        <small>Gunakan file monitoring yang disetujui dan akses baca yang diberikan untuk aplikasi.</small>
      </label>

      <label class="field">
        <span>Tab monitoring progres</span>
        <input type="text" disabled placeholder="Menunggu konfirmasi nama tab" />
      </label>

      <label class="field">
        <span>Tab penyerapan RKAP / GR-IR</span>
        <input type="text" disabled placeholder="Disiapkan oleh mentor" />
      </label>

      <div class="field field-wide">
        <span>Status integrasi</span>
        <div class="connection-status">
          <span class="status-dot"></span>
          <div>
            <strong>Koneksi belum dikonfigurasi</strong>
            <p>Dashboard tetap berjalan menggunakan sumber data yang saat ini dikonfigurasi oleh aplikasi. Halaman ini belum menyambungkan file Google Sheets.</p>
          </div>
        </div>
      </div>

      <div class="field-wide action-row">
        <button type="button" class="btn-disabled" disabled>Hubungkan Google Sheets</button>
        <span>Diaktifkan setelah URL, nama tab, dan akses spreadsheet dikonfirmasi.</span>
      </div>
    </div>
  </section>

  <section class="integration-cards">
    <article class="integration-card">
      <div class="card-icon">▦</div>
      <div class="card-main">
        <h2>File monitoring lama</h2>
        <p>Direncanakan menjadi sumber nama pekerjaan, PIC, tahapan progres, tanggal, status, dan catatan kendala.</p>
      </div>
      <span class="status-pill pending">Menunggu sumber</span>
    </article>

    <article class="integration-card">
      <div class="card-icon">↗</div>
      <div class="card-main">
        <h2>Penyerapan RKAP / GR-IR</h2>
        <p>Direncanakan mengambil data dari tab khusus yang disiapkan mentor. Nilai tidak ditampilkan sebelum sumber tersedia.</p>
      </div>
      <span class="status-pill pending">Menunggu sumber</span>
    </article>

    <article class="integration-card">
      <div class="card-icon">↔</div>
      <div class="card-main">
        <h2>IPRO / SAP</h2>
        <p>Belum termasuk koneksi aktif pada tahap ini. Pengambilan data akan mengikuti persetujuan dan mekanisme resmi.</p>
      </div>
      <span class="status-pill pending">Pengembangan lanjutan</span>
    </article>
  </section>

  <div class="integration-note">
    <strong>Catatan:</strong> untuk sementara, tidak perlu memasukkan kredensial atau membagikan file melalui halaman ini. Setelah sumber disetujui, koneksi akan disiapkan melalui konfigurasi server yang aman. Kunci akses tidak boleh diletakkan di browser atau repositori.
  </div>
</section>

<style>
  .integration-page { display: grid; gap: 18px; color: #111111; }
  .integration-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; }
  .integration-heading h1 { font-size: clamp(23px, 2vw, 28px); margin: 5px 0 7px; font-weight: 700; letter-spacing: -0.025em; color: #111111; }
  .integration-heading p, .panel-heading p { margin: 0; max-width: 780px; font-size: 13px; line-height: 1.6; color: #5a5f67; }
  .eyebrow { font-size: 11px; letter-spacing: 0.08em; font-weight: 700; color: #5a5f67; text-transform: uppercase; }
  .integration-panel { border: 1px solid #eaeaea; border-radius: 14px; background: #fff; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.02); }
  .panel-heading { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; padding-bottom: 15px; border-bottom: 1px solid #eaeaea; }
  .panel-heading h2 { margin: 0 0 6px; font-size: 16px; font-weight: 700; color: #111111; }
  .read-only-tag { background: #f1f5f9; color: #475569; border-radius: 999px; padding: 5px 10px; font-size: 11px; font-weight: 600; white-space: nowrap; }
  .status-pill { display: inline-flex; align-items: center; gap: 7px; border-radius: 999px; padding: 6px 12px; font-size: 11px; font-weight: 600; white-space: nowrap; }
  .status-pill.pending { background: #f8fafc; color: #64748b; border: 1px solid #e2e8f0; }
  .status-dot { display: inline-block; flex: 0 0 8px; width: 8px; height: 8px; border-radius: 50%; background: #94a3b8; }
  .integration-form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; padding-top: 17px; }
  .field { display: grid; align-content: start; gap: 6px; min-width: 0; }
  .field > span { font-size: 12px; font-weight: 650; color: #333333; }
  .field input { width: 100%; height: 42px; padding: 10px 14px; border: 1px solid #d8dbe0; border-radius: 8px; background: #f8f9fa; color: #5a5f67; font-size: 13px; box-sizing: border-box; }
  .field input:disabled { cursor: not-allowed; opacity: 1; }
  .field input::placeholder { color: #8c929c; }
  .field small { font-size: 11px; line-height: 1.5; color: #8c929c; }
  .field-wide { grid-column: 1 / -1; }
  .connection-status { display: flex; align-items: flex-start; gap: 10px; background: #f8f9fa; border: 1px solid #eaeaea; border-radius: 10px; padding: 14px; }
  .connection-status .status-dot { margin-top: 4px; }
  .connection-status strong { font-size: 13px; color: #111111; }
  .connection-status p { font-size: 12px; line-height: 1.5; color: #5a5f67; margin: 4px 0 0; }
  .action-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .btn-disabled { border: 1px solid #d8dbe0; border-radius: 8px; padding: 9px 16px; background: #f1f5f9; color: #94a3b8; font-weight: 600; font-size: 12px; cursor: not-allowed; }
  .action-row span { font-size: 11px; color: #8c929c; }
  .integration-cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
  .integration-card { min-width: 0; border: 1px solid #eaeaea; border-radius: 12px; background: #fff; padding: 18px; display: grid; grid-template-columns: 38px minmax(0, 1fr); gap: 12px 14px; align-content: start; box-shadow: 0 1px 3px rgba(0,0,0,0.02); }
  .card-icon { width: 38px; height: 38px; border-radius: 10px; background: #f1f5f9; color: #333333; display: grid; place-items: center; font-size: 20px; font-weight: 700; }
  .card-main h2 { font-size: 14px; font-weight: 700; margin: 2px 0 6px; color: #111111; }
  .card-main p { font-size: 12px; line-height: 1.55; margin: 0; color: #5a5f67; }
  .integration-card .status-pill { grid-column: 1 / -1; justify-self: start; }
  .integration-note { background: #f8f9fa; border: 1px solid #eaeaea; border-radius: 10px; padding: 14px 16px; color: #5a5f67; font-size: 12px; line-height: 1.6; }
  .integration-note strong { color: #111111; }
  @media (max-width: 1000px) { .integration-cards { grid-template-columns: 1fr; } }
  @media (max-width: 700px) { .integration-heading, .panel-heading { flex-direction: column; align-items: stretch; } .integration-panel { padding: 14px; } .integration-form { grid-template-columns: 1fr; } .field-wide { grid-column: 1; } }
</style>
