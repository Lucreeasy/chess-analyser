<script lang="ts">
  /** docs/06-GAMES-SPEC.md section B10: the Explore panel, replacing the info card while exploring. */
  import { scoreTextFromLine } from "../lib/scoreText.ts";
  import type { ExploreState } from "../lib/explore.svelte.ts";

  let {
    explore,
    onBackToGame,
  }: {
    explore: ExploreState;
    onBackToGame: () => void;
  } = $props();

  // lineText is always "{number}{.|...} {move} ...", so the first move is always the second token.
  function firstMoveOf(lineText: string): string {
    return lineText.split(" ")[1] ?? lineText;
  }
</script>

<section class="card" aria-label="Explore mode">
  <h2>Exploring</h2>
  <div class="actions">
    <button type="button" onclick={() => explore.undo()} disabled={!explore.canUndo}>Undo</button>
    <button type="button" class="primary" onclick={onBackToGame}>Back to game</button>
  </div>
  {#if explore.lineText}
    <p class="your-line">{explore.lineText}</p>
  {/if}
  <p class="status" aria-live="polite">{explore.statusText}</p>
  {#if explore.lines.length > 0}
    <ol class="lines">
      {#each explore.lines as line, i (i)}
        <li title={firstMoveOf(line.lineText)}>
          <span class="score">{scoreTextFromLine(line)}</span>
          <span class="line-text">{line.lineText}</span>
        </li>
      {/each}
    </ol>
  {/if}
</section>

<style>
  h2 {
    font-size: 15px;
    margin: 0 0 12px;
  }
  .actions {
    display: flex;
    gap: 8px;
  }
  .actions button {
    min-height: 44px;
    padding: 0 16px;
    border: 1px solid var(--line);
    border-radius: 12px;
    background: var(--surface);
    color: var(--ink);
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
  }
  .actions button:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
  .actions button.primary {
    border: none;
    background: var(--brand);
    color: var(--brand-ink);
  }
  .your-line {
    margin: 12px 0 0;
    font-size: 13px;
    color: var(--muted);
  }
  .status {
    margin: 8px 0 0;
    font-size: 14px;
    font-weight: 600;
  }
  .lines {
    list-style: none;
    margin: 8px 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .lines li {
    display: flex;
    gap: 8px;
    font-size: 13px;
    padding: 4px 0;
  }
  .score {
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    min-width: 40px;
    flex: none;
  }
  .line-text {
    color: var(--muted);
  }
</style>
