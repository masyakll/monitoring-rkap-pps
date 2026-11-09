<script lang="ts">
  import '../app.css';
  import type { LayoutData } from './$types.js';

  export let data: LayoutData;
</script>

{#if data.isDemoMode}
  <div class="demo-status-banner" role="status" aria-label="Mode demo aktif">
    <strong>MODE DEMO</strong>
    <span>Angka, anggaran, progres, dan prognosa yang ditampilkan adalah data simulasi.</span>
  </div>
{/if}

<slot />

<style>
  .demo-status-banner {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
    gap: 0.5rem;
    min-height: 30px;
    padding: 0.35rem 0.85rem;
    border-bottom: 1px solid #dce2e9;
    background: #f2f5f8;
    color: #4b5563;
    font-size: 0.72rem;
    line-height: 1.35;
    text-align: center;
  }

  .demo-status-banner strong {
    color: #202b38;
    font-size: 0.66rem;
    font-weight: 800;
    letter-spacing: 0.08em;
  }

  @media (max-width: 560px) {
    .demo-status-banner {
      justify-content: flex-start;
      text-align: left;
    }
  }
</style>
