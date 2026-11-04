<script lang="ts">
  import Logo from "../components/Logo.svelte";

  let { title }: { title: string } = $props();
</script>

<div class="page">
  <h1><Logo />{title}</h1>
  <p class="muted">This screen is not built yet.</p>
</div>

<style>
  .page {
    max-width: 1280px;
    margin: 0 auto;
    padding: 16px;
  }
  h1 {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 24px;
    line-height: 32px;
    font-weight: 600;
  }
  .muted {
    color: var(--muted);
    font-size: 14px;
    margin-top: 4px;
  }
</style>
