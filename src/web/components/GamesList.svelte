<script lang="ts">
  import ColourMarker from "./ColourMarker.svelte";
  import ResultBadge from "./ResultBadge.svelte";
  import StatusBadge from "./StatusBadge.svelte";
  import Icon from "./Icon.svelte";
  import { formatDate, timeClassLabel, accuracyText, countText } from "../lib/format.ts";
  import type { SortKey, SortDirection } from "../lib/gamesSort.ts";
  import type { GameRow } from "../lib/types.ts";

  let {
    games,
    sortKey,
    sortDirection,
    onSort,
    selected,
    onToggleSelect,
    onToggleSelectAll,
  }: {
    games: GameRow[];
    sortKey: SortKey;
    sortDirection: SortDirection;
    onSort: (key: SortKey) => void;
    selected: Set<string>;
    onToggleSelect: (id: string) => void;
    onToggleSelectAll: () => void;
  } = $props();

  function openingLabel(game: GameRow): string {
    return game.openingName ?? game.openingFamily ?? game.eco ?? "–";
  }

  function opponentLabel(game: GameRow): string {
    return game.opponent ?? `${game.white} vs ${game.black}`;
  }

  const allSelected = $derived(games.length > 0 && games.every((g) => selected.has(g.id)));
  const someSelected = $derived(!allSelected && games.some((g) => selected.has(g.id)));

  function indeterminate(node: HTMLInputElement, value: boolean) {
    node.indeterminate = value;
    return {
      update(v: boolean) {
        node.indeterminate = v;
      },
    };
  }

  const columns: Array<{ key: SortKey; label: string }> = [
    { key: "date", label: "Date" },
    { key: "opponent", label: "Opponent" },
    { key: "rating", label: "Rating" },
    { key: "colour", label: "Colour" },
    { key: "result", label: "Result" },
    { key: "time", label: "Time" },
    { key: "opening", label: "Opening" },
    { key: "accuracy", label: "Accuracy" },
    { key: "blunders", label: "Blunders" },
    { key: "status", label: "Status" },
  ];

  function ariaSort(key: SortKey): "ascending" | "descending" | "none" {
    if (key !== sortKey) return "none";
    return sortDirection === "asc" ? "ascending" : "descending";
  }
</script>

<table class="games-table">
  <caption class="sr-only">
    Games, sorted by {columns.find((c) => c.key === sortKey)?.label} {sortDirection === "asc" ? "ascending" : "descending"}
  </caption>
  <thead>
    <tr>
      <th scope="col" class="checkbox-col">
        <input type="checkbox" checked={allSelected} use:indeterminate={someSelected} onchange={onToggleSelectAll} aria-label="Select all games on this page" />
      </th>
      {#each columns as column (column.key)}
        <th scope="col" aria-sort={ariaSort(column.key)}>
          <button type="button" onclick={() => onSort(column.key)}>
            {column.label}
            {#if column.key === sortKey}
              <Icon name={sortDirection === "asc" ? "sortAsc" : "sortDesc"} size={14} />
            {/if}
          </button>
        </th>
      {/each}
    </tr>
  </thead>
  <tbody>
    {#each games as game (game.id)}
      <tr class:selected={selected.has(game.id)}>
        <td class="checkbox-col">
          <input type="checkbox" checked={selected.has(game.id)} onchange={() => onToggleSelect(game.id)} aria-label={`Select game vs ${opponentLabel(game)}`} />
        </td>
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

<label class="select-all-row">
  <input type="checkbox" checked={allSelected} use:indeterminate={someSelected} onchange={onToggleSelectAll} />
  Select all on this page
</label>

<ul class="games-cards">
  {#each games as game (game.id)}
    <li class="card" class:selected={selected.has(game.id)}>
      <input
        type="checkbox"
        class="card-checkbox"
        checked={selected.has(game.id)}
        onchange={() => onToggleSelect(game.id)}
        aria-label={`Select game vs ${opponentLabel(game)}`}
      />
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

  .select-all-row {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    color: var(--muted);
    font-size: 14px;
    margin-bottom: 8px;
  }
  .games-table {
    display: none;
  }
  .checkbox-col {
    width: 44px;
  }
  .games-table tr.selected {
    background: var(--surface-2);
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
    position: relative;
    border: 1px solid var(--line);
    border-radius: 16px;
    padding: 12px;
    background: var(--surface);
  }
  .card.selected {
    border-color: var(--brand);
    background: var(--surface-2);
  }
  .card-checkbox {
    position: absolute;
    top: 12px;
    left: 12px;
  }
  .card-line1 {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding-left: 32px;
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
    .select-all-row {
      display: none;
    }
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
      padding: 0;
    }
    .games-table th button {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      height: 44px;
      padding: 0 12px;
      border: none;
      background: none;
      color: inherit;
      font: inherit;
      text-transform: inherit;
      letter-spacing: inherit;
      cursor: pointer;
    }
    .games-table th[aria-sort]:not([aria-sort="none"]) button {
      color: var(--ink);
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
