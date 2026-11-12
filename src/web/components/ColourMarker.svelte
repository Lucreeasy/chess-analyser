<script lang="ts">
  /** A colour disc with its name, or with `text` instead; `size` is the disc's size in px. */
  let { colour, text, size = 14 }: { colour: "w" | "b" | undefined; text?: string; size?: number } = $props();

  const label = $derived(text ?? (colour === "w" ? "White" : colour === "b" ? "Black" : "Unknown"));
</script>

<span class="colour">
  <span class="disc disc-{colour ?? 'unknown'}" style={`width: ${size}px; height: ${size}px`} aria-hidden="true"></span>
  {label}
</span>

<style>
  .colour {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .disc {
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
