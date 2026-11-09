<script lang="ts">
  import { countUp, type FormatType } from '$lib/utils/countUp';

  export let value: number | null | undefined = 0;
  export let format: FormatType = 'integer';
  export let prefix = '';
  export let suffix = '';
  export let decimals = 0;
  export let duration = 1200;
  let customClass = '';
  export { customClass as class };
</script>

<span
  class={customClass}
  use:countUp={{ value, format, prefix, suffix, decimals, duration }}
>
  —
</span>

