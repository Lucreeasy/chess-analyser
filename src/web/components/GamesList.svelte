<script lang="ts">
  import ColourMarker from "./ColourMarker.svelte";
  import ResultBadge from "./ResultBadge.svelte";
  import StatusBadge from "./StatusBadge.svelte";
  import { formatDate, timeClassLabel, accuracyText, countText } from "../lib/format.ts";
  import type { GameRow } from "../lib/types.ts";

  let { games }: { games: GameRow[] } = $props();

  function openingLabel(game: GameRow): string {
    return game.openingName ?? game.openingFamily ?? game.eco ?? "–";
  }
</script>

<table class="games-table">
  <caption class="sr-only">Games, sorted by date descending</caption>
  <thead>
    <tr>
      <th scope="col">Date</th>
      <th scope="col">Opponent</th>
      <th scope="col">Rating</th>
      <th scope="col">Colour</th>
      <th scope="col">Result</th>
      <th scope="col">Time</th>
      <th scope="col">Opening</th>
      <th scope="col">Accuracy</th>
      <th scope="col">Blunders</th>
      <th scope="col">Status</th>
    </tr>
  </thead>
  <tbody>
    {#each games as game (game.id)}
      <tr>
        <td>{formatDate(game.playedAt)}</td>
        <td>
          {#if game.opponent}
            <a href={`#/games/${encodeURIComponent(game.id)}`}>{game.opponent}</a>
          {:else}
            {game.white} vs {game.black}
          {/if}
        </td>
        <td class="num">{countText(game.opponentRating)}</td>
        <td><ColourMarker colour={game.myColour} /></td>
        <td><ResultBadge myResult={game.myResult} result={game.result} /></td>
        <td>{timeClassLabel(game.timeClass)}</td>
        <td class="truncate" title={openingLabel(game)}>{openingLabel(game)}</td>
        <td class="num">{accuracyText(game.accuracy)}</td>
        <td class="num">{countText(game.blunders)}</td>
        <td><StatusBadge status={game.analysisStatus} /></td>
      </tr>
    {/each}
  </tbody>
</table>

<ul class="games-cards">
  {#each games as game (game.id)}
    <li class="card">
      <div class="card-line1">
        <a href={`#/games/${encodeURIComponent(game.id)}`} class="card-link">
          {#if game.opponent}
            {game.opponent}{game.opponentRating ? ` (${game.opponentRating})` : ""}
          {:else}
            {game.white} vs {game.black}
          {/if}
        </a>
        <ResultBadge myResult={game.myResult} result={game.result} />
      </div>
      <div class="card-line2 muted">
        <ColourMarker colour={game.myColour} />
        {timeClassLabel(game.timeClass)}
        {formatDate(game.playedAt)}
      </div>
      <div class="card-line3 truncate">{openingLabel(game)}</div>
      <div class="card-line4 muted">
        Accuracy {accuracyText(game.accuracy)} · Blunders {countText(game.blunders)}
        <StatusBadge status={game.analysisStatus} />
      </div>
    </li>
  {/each}
</ul>

<style>
  .muted {
    color: var(--muted);
  }
  .truncate {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 256px;
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
  }

  .games-table {
    display: none;
  }
  .games-cards {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .card {
    border: 1px solid var(--line);
    border-radius: 16px;
    padding: 12px;
    background: var(--surface);
  }
  .card-line1 {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .card-link {
    font-size: 16px;
    font-weight: 600;
    text-decoration: none;
    color: var(--ink);
  }
  .card-line2,
  .card-line4 {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    margin-top: 6px;
  }
  .card-line3 {
    font-size: 14px;
    margin-top: 6px;
  }

  @media (min-width: 768px) {
    .games-cards {
      display: none;
    }
    .games-table {
      display: table;
      width: 100%;
      border-collapse: collapse;
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: 16px;
      overflow: hidden;
      font-size: 14px;
    }
    .games-table th {
      background: var(--surface-2);
      text-align: left;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--muted);
      padding: 8px 12px;
    }
    .games-table td {
      padding: 10px 12px;
      border-top: 1px solid var(--line);
    }
    .games-table .num {
      text-align: right;
    }
  }
</style>
