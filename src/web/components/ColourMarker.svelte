<script lang="ts">
  let { colour }: { colour: "w" | "b" | undefined } = $props();

  const label = $derived(colour === "w" ? "White" : colour === "b" ? "Black" : "Unknown");
</script>

<span class="colour">
  <span class="disc disc-{colour ?? 'unknown'}" aria-hidden="true"></span>
  {label}
</span>

<style>
  .colour {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .disc {
    width: 14px;
    height: 14px;
    border-radius: 999px;
    border: 1px solid var(--line);
    flex: none;
  }
  .disc-w {
    background: #fbfaf5;
  }
  .disc-b {
    background: #1d2127;
  }
  .disc-unknown {
    background: transparent;
    border-style: dashed;
  }
</style>
