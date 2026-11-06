<script lang="ts">
  /**
   * docs/06-GAMES-SPEC.md section B4: White's winning chances (Win%), not
   * centipawns, saturating like chess.com's. Vertical on desktop, horizontal
   * on phone, both handled here with one fill direction derived from the
   * layout + orientation.
   */
  let {
    winPercent,
    scoreText,
    flipped = false,
  }: {
    /** undefined for an unanalysed game with no live data yet: bar at 50%, score "–". */
    winPercent: number | undefined;
    scoreText: string;
    flipped: boolean;
  } = $props();

  const whiteShare = $derived(winPercent ?? 50);
  const label = $derived(
    winPercent === undefined
      ? "Evaluation not available"
      : `Evaluation ${scoreText}. White ${Math.round(winPercent)}%, Black ${Math.round(100 - winPercent)}% winning chances`,
  );
</script>

<div
  class="eval"
  class:flipped
  role="meter"
  aria-label={label}
  aria-valuemin="0"
  aria-valuemax="100"
  aria-valuenow={Math.round(whiteShare)}
>
  <div class="bar">
    <div class="white-share" style={`--share: ${whiteShare}%`}></div>
    <div class="mid-line"></div>
  </div>
  <span class="score">{scoreText}</span>
</div>

<style>
  .eval {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }
  .bar {
    position: relative;
    flex: 1;
    width: 18px;
    border: 1px solid var(--line);
    border-radius: 6px;
    overflow: hidden;
    background: var(--eval-black);
  }
  .white-share {
    position: absolute;
    inset-inline: 0;
    bottom: 0;
    height: var(--share);
    background: var(--eval-white);
  }
  .mid-line {
    position: absolute;
    left: 0;
    right: 0;
    top: 50%;
    height: 1px;
    background: var(--eval-mid);
  }
  .score {
    font-size: 12px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .flipped .white-share {
    bottom: auto;
    top: 0;
  }

  @media (max-width: 767px) {
    .eval {
      flex-direction: row;
      width: 100%;
    }
    .bar {
      width: auto;
      height: 10px;
    }
    .white-share {
      inset-inline: auto;
      inset-block: 0;
      left: 0;
      width: var(--share);
      height: auto;
    }
    .mid-line {
      top: 0;
      bottom: 0;
      left: 50%;
      right: auto;
      width: 1px;
      height: auto;
    }
    .flipped .white-share {
      left: auto;
      right: 0;
    }
  }
</style>
