<script lang="ts">
  import { icons } from "../lib/icons.ts";

  let { name, size = 20 }: { name: keyof typeof icons; size?: number } = $props();
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
  focusable="false"
>{@html icons[name]}</svg>
