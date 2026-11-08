<script lang="ts">
  import Icon from "./Icon.svelte";
  import type { DrillLink } from "../lib/insightsLinks.ts";

  /** A stat tile; with a link it opens the games behind the number. docs/07-UI-SPEC.md section 5.10. */
  let { label, value, sub, link }: { label: string; value: string; sub?: string; link?: DrillLink } = $props();
</script>

<svelte:element this={link ? "a" : "div"} class="tile" class:drill={!!link} href={link?.href} title={link?.hint}>
  <span class="label-row">
    <span class="label">{label}</span>
    {#if link}<Icon name="chevronRight" size={18} />{/if}
  </span>
  <span class="value">{value}</span>
  {#if sub}<span class="sub">{sub}</span>{/if}
  {#if link}<span class="sr-only">{link.hint}</span>{/if}
</svelte:element>

<style>
  .label-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 8px;
    color: var(--muted);
    font-size: 14px;
  }
  .label-row :global(svg) {
    flex: none;
  }
  .value {
    font-size: 24px;
    line-height: 32px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .sub {
    color: var(--muted);
    font-size: 12px;
  }
</style>
