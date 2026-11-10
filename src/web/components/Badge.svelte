<script lang="ts">
  import type { Snippet } from "svelte";

  /**
   * A badge (docs/07-UI-SPEC.md section 5.9): an optional tone, and a text mark or a glyph snippet before the label.
   * `outline` draws the border in the tone colour too (the "Problem" and "Strong" flags).
   */
  let {
    tone,
    mark,
    label,
    outline = false,
    title,
    children,
  }: { tone?: "ok" | "danger" | "brand" | "muted"; mark?: string; label: string; outline?: boolean; title?: string; children?: Snippet } = $props();
</script>

<span class="badge tone-{tone ?? 'ink'}" class:outline {title}>
  {#if children}{@render children()}{:else if mark}<span aria-hidden="true">{mark}</span>{/if}
  {label}
</span>

<style>
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border-radius: 999px;
    border: 1px solid var(--line);
    background: var(--surface-2);
    font-size: 12px;
    font-weight: 600;
    white-space: nowrap;
  }
  .outline {
    border-color: currentColor;
  }
  .tone-ok {
    color: var(--ok);
  }
  .tone-danger {
    color: var(--danger);
  }
  .tone-brand {
    color: var(--brand);
  }
  .tone-muted {
    color: var(--muted);
  }
</style>
