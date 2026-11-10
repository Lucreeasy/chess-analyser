<script lang="ts">
  import Icon from "./Icon.svelte";
  import type { DrillLink } from "../lib/insightsLinks.ts";

  /**
   * A stat tile; with a link it opens the games behind the number. docs/07-UI-SPEC.md section 5.10. `bar` (0-100)
   * adds an 8 px decorative bar in the `tone` colour; `warn` prints the value in Danger.
   */
  let {
    label,
    value,
    sub,
    link,
    bar,
    tone = "brand",
    warn = false,
  }: { label: string; value: string; sub?: string; link?: DrillLink; bar?: number; tone?: "brand" | "accent" | "danger"; warn?: boolean } = $props();
</script>

<svelte:element this={link ? "a" : "div"} class="tile" class:drill={!!link} href={link?.href} title={link?.hint}>
  <span class="label-row">
    <span class="label">{label}</span>
    {#if link}<Icon name="chevronRight" size={18} />{/if}
  </span>
  <span class="value" class:warn>{value}</span>
  {#if sub}<span class="sub">{sub}</span>{/if}
  {#if bar !== undefined}
    <span class="progress" aria-hidden="true"><span class="fill" style={`width: ${bar}%; background: var(--${tone})`}></span></span>
  {/if}
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
  .warn {
    color: var(--danger);
  }
  .progress {
    height: 8px;
    margin-top: 6px;
  }
  .fill {
    display: block;
  }
  .sub {
    color: var(--muted);
    font-size: 12px;
  }
</style>
