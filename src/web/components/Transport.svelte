<script lang="ts">
  import Icon from "./Icon.svelte";

  let {
    currentPly,
    plyCount,
    playing,
    disabled = false,
    onFirst,
    onPrevious,
    onTogglePlay,
    onNext,
    onLast,
  }: {
    currentPly: number;
    plyCount: number;
    playing: boolean;
    disabled?: boolean;
    onFirst: () => void;
    onPrevious: () => void;
    onTogglePlay: () => void;
    onNext: () => void;
    onLast: () => void;
  } = $props();

  const atStart = $derived(currentPly === 0);
  const atEnd = $derived(currentPly >= plyCount);
</script>

<div role="group" aria-label="Move navigation" class="transport">
  <button type="button" onclick={onFirst} disabled={disabled || atStart} aria-label="First move">
    <Icon name="firstMove" size={22} />
  </button>
  <button type="button" onclick={onPrevious} disabled={disabled || atStart} aria-label="Previous move">
    <Icon name="chevronLeft" size={22} />
  </button>
  <button
    type="button"
    class="play"
    onclick={onTogglePlay}
    disabled={disabled || (atEnd && !playing)}
    aria-label={playing ? "Pause" : "Play through the game"}
    aria-pressed={playing}
  >
    <Icon name={playing ? "pause" : "play"} size={22} />
  </button>
  <button type="button" onclick={onNext} disabled={disabled || atEnd} aria-label="Next move">
    <Icon name="chevronRight" size={22} />
  </button>
  <button type="button" onclick={onLast} disabled={disabled || atEnd} aria-label="Last move">
    <Icon name="lastMove" size={22} />
  </button>
</div>

<style>
  /* docs/07-UI-SPEC.md section 8.3: five equal buttons filling the row, 44 px high, 6 px gaps. */
  .transport {
    display: flex;
    gap: 6px;
  }
  button {
    flex: 1 1 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 44px;
    border: 1px solid var(--line);
    border-radius: 12px;
    background: var(--surface);
    color: var(--ink);
    cursor: pointer;
  }
  button.play {
    border: none;
    background: var(--brand);
    color: var(--brand-ink);
  }
  button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
</style>
