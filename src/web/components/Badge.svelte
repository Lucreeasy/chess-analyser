<script lang="ts">
  let { tone, mark, label }: { tone: "ok" | "danger" | "brand" | "muted"; mark: string; label: string } = $props();
</script>

<span class="badge tone-{tone}"><span aria-hidden="true">{mark}</span> {label}</span>

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
