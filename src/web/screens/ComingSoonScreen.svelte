<script lang="ts">
  import Logo from "../components/Logo.svelte";

  let { title }: { title: string } = $props();
</script>

<div class="page">
  <h1 class="page-title"><Logo />{title}</h1>
  <p class="muted">This screen is not built yet.</p>
</div>

<style>
  .muted {
    color: var(--muted);
    font-size: 14px;
    margin-top: 4px;
  }
</style>
