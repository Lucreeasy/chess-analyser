<script lang="ts">
  import ColourMarker from "./ColourMarker.svelte";
  import ClassBadge from "./ClassBadge.svelte";
  import Badge from "./Badge.svelte";
  import { CLASS_INFO } from "../../server/analysis/texts.ts";
  import { ALL_CLASSES } from "../../server/analysis/classification.ts";
  import { timeClassLabel, formatDate } from "../lib/format.ts";
  import type { GameReviewRow } from "../../server/games/reviewRow.ts";
  import type { Colour } from "../../server/analysis/game.ts";
  import type { Phase } from "../../server/analysis/phases.ts";

  const ALL_PHASES: Phase[] = ["opening", "middlegame", "endgame"];

  let { game }: { game: GameReviewRow } = $props();

  function sideLabel(colour: Colour): string {
    return game.myColour === colour ? "You" : colour === "w" ? "White" : "Black";
  }

  const mySide: Colour = $derived(game.myColour ?? "w");
  const theirSide: Colour = $derived(mySide === "w" ? "b" : "w");

  const phaseRows = $derived(
    game.analysis
      ? ALL_PHASES.filter((p) => game.analysis!.summary.phaseAccuracy.w[p] !== undefined || game.analysis!.summary.phaseAccuracy.b[p] !== undefined)
      : [],
  );

  const openingText = $derived([game.eco, game.openingName].filter(Boolean).join(" · ") || undefined);
</script>

{#snippet details()}
  <dl class="details">
    <div class="side-row">
      <ColourMarker colour="w" />
      <dt>White</dt>
      <dd>
        {game.white}{game.whiteElo ? ` (${game.whiteElo})` : ""}
        {#if game.myColour === "w"}<Badge tone="brand" mark="●" label="You" />{/if}
      </dd>
    </div>
    <div class="side-row">
      <ColourMarker colour="b" />
      <dt>Black</dt>
      <dd>
        {game.black}{game.blackElo ? ` (${game.blackElo})` : ""}
        {#if game.myColour === "b"}<Badge tone="brand" mark="●" label="You" />{/if}
      </dd>
    </div>
    <div class="fact-row">
      <dt>Result</dt>
      <dd>{game.result}{game.termination ? ` · ${game.termination}` : ""}</dd>
    </div>
    <div class="fact-row">
      <dt>Time control</dt>
      <dd>{timeClassLabel(game.timeClass)} · {game.timeControlText}</dd>
    </div>
    <div class="fact-row">
      <dt>Opening</dt>
      <dd>{openingText ?? "–"}</dd>
    </div>
    <div class="fact-row">
      <dt>Played</dt>
      <dd>{formatDate(game.playedAt)}</dd>
    </div>
  </dl>
{/snippet}

<div class="summary">
  {#if game.analysis}
    {@const summary = game.analysis.summary}
    <div class="tiles">
      {#each [mySide, theirSide] as colour (colour)}
        <div class="tile" class:mine={colour === game.myColour}>
          <ColourMarker {colour} />
          <span class="name">{sideLabel(colour)}</span>
          <span class="accuracy">{summary.accuracy[colour].toFixed(1)}%</span>
          <span class="muted">accuracy</span>
        </div>
      {/each}
    </div>

    <table class="quality">
      <caption class="sr-only">Moves by quality, per side</caption>
      <thead>
        <tr>
          <th scope="col">Move</th>
          <th scope="col">{sideLabel(mySide)}</th>
          <th scope="col">{sideLabel(theirSide)}</th>
        </tr>
      </thead>
      <tbody>
        {#each ALL_CLASSES as cls (cls)}
          <tr>
            <td class="cls-cell"><ClassBadge {cls} size={18} />{CLASS_INFO[cls].label}</td>
            <td class="num">{summary.counts[mySide][cls]}</td>
            <td class="num">{summary.counts[theirSide][cls]}</td>
          </tr>
        {/each}
      </tbody>
    </table>

    {#if phaseRows.length > 0}
      <table class="phases">
        <caption>Accuracy by phase</caption>
        <thead>
          <tr>
            <th scope="col"></th>
            <th scope="col">{sideLabel(mySide)}</th>
            <th scope="col">{sideLabel(theirSide)}</th>
          </tr>
        </thead>
        <tbody>
          {#each phaseRows as phase (phase)}
            <tr>
              <td>{phase[0]!.toUpperCase()}{phase.slice(1)}</td>
              <td class="num">{summary.phaseAccuracy[mySide][phase]?.toFixed(1) ?? "–"}</td>
              <td class="num">{summary.phaseAccuracy[theirSide][phase]?.toFixed(1) ?? "–"}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}

    {@render details()}

    <p class="footnote">
      Our model, based on lichess's open formulas — numbers differ from chess.com. {summary.engine}, depth {summary.depth}.
    </p>
  {:else}
    {@render details()}
    <p class="muted">Accuracy and move counts appear here once the game is analysed.</p>
  {/if}
</div>

<style>
  .summary {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 4px;
  }
  .tiles {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .tile {
    padding: 10px;
  }
  .tile.mine {
    border-color: var(--brand);
    background: var(--surface-2);
  }
  .name {
    font-size: 13px;
    font-weight: 600;
  }
  .accuracy {
    font-size: 20px;
    font-weight: 700;
  }
  .muted {
    color: var(--muted);
    font-size: 13px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
  }
  caption {
    text-align: left;
    font-size: 13px;
    font-weight: 600;
    margin-bottom: 6px;
  }
  th {
    text-align: left;
    color: var(--muted);
    font-size: 12px;
    padding: 4px;
  }
  td {
    padding: 4px;
    border-top: 1px solid var(--line);
  }
  .cls-cell {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .num {
    text-align: right;
  }
  .details {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: 0;
    font-size: 14px;
  }
  .side-row,
  .fact-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  dt {
    color: var(--muted);
    min-width: 90px;
  }
  dd {
    margin: 0;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .footnote {
    font-size: 12px;
    color: var(--muted);
  }
</style>
