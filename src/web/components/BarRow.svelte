<script lang="ts">
  import Icon from "./Icon.svelte";
  import type { DrillLink } from "../lib/insightsLinks.ts";

  /**
   * A drill row: name (and hint) at the left, value (and sub-line) with the cue at the right, an 8 px decorative
   * bar (0-100) in the `tone` colour below. Insights playstyle axes and tactics rows.
   */
  let {
    label,
    hint,
    value,
    sub,
    bar,
    tone = "brand",
    link,
  }: { label: string; hint?: string; value: string; sub?: string; bar: number; tone?: "brand" | "accent" | "muted"; link?: DrillLink } = $props();
</script>

<svelte:element this={link ? "a" : "div"} class="tile row" class:drill={!!link} href={link?.href} title={link?.hint}>
  <span class="top">
    <span>
      <span class="name">{label}</span>
      {#if hint}<span class="fine">{hint}</span>{/if}
    </span>
    <span class="end">
      <span>
        <span class="value">{value}</span>
        {#if sub}<span class="fine">{sub}</span>{/if}
      </span>
      {#if link}<Icon name="chevronRight" size={18} />{/if}
    </span>
  </span>
  <span class="progress" aria-hidden="true"><span class="fill" style={`width: ${bar}%; background: var(--${tone})`}></span></span>
  {#if link}<span class="sr-only">{link.hint}</span>{/if}
</svelte:element>

<style>
  .row {
    gap: 8px;
  }
  .top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }
  .top > span > span,
  .end > span > span {
    display: block;
  }
  .end {
    flex: none;
    display: flex;
    align-items: center;
    gap: 4px;
    text-align: right;
  }
  .name {
    font-size: 16px;
    font-weight: 500;
  }
  .value {
    font-size: 18px;
    font-weight: 600;
  }
  .progress {
    height: 8px;
  }
  .fill {
    display: block;
  }
</style>
