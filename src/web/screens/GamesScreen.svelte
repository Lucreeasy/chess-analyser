<script lang="ts">
  import Logo from "../components/Logo.svelte";
  import Icon from "../components/Icon.svelte";
  import GamesList from "../components/GamesList.svelte";
  import FilterPanel from "../components/FilterPanel.svelte";
  import { apiGet, apiPost, ApiError } from "../lib/api.ts";
  import { showToast } from "../lib/toasts.svelte.ts";
  import { defaultFilters, filterGames, activeFilterCount, computeFacets, type GamesFilters } from "../lib/gamesFilter.ts";
  import { sortGames, FIRST_DIRECTION, type SortKey, type SortDirection } from "../lib/gamesSort.ts";
  import { paginate, pageCount, clampPage } from "../lib/paginate.ts";
  import type { GameRow } from "../lib/types.ts";

  let games: GameRow[] | undefined = $state(undefined);
  let loadError: string | undefined = $state(undefined);
  let syncing = $state(false);

  let filters: GamesFilters = $state(defaultFilters());
  let searchInput = $state("");
  let showFiltersPanel = $state(false);
  let searchDebounce: ReturnType<typeof setTimeout> | undefined;

  function onSearchInput(value: string): void {
    searchInput = value;
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      filters = { ...filters, search: value.trim().slice(0, 100) };
    }, 300);
  }

  const facets = $derived(computeFacets(games ?? []));
  const filteredGames = $derived(games ? filterGames(games, filters) : undefined);
  const filterCount = $derived(activeFilterCount(filters));

  let sortKey: SortKey = $state("date");
  let sortDirection: SortDirection = $state("desc");

  function onSort(key: SortKey): void {
    if (key === sortKey) {
      sortDirection = sortDirection === "asc" ? "desc" : "asc";
    } else {
      sortKey = key;
      sortDirection = FIRST_DIRECTION[key];
    }
  }

  const sortedGames = $derived(filteredGames ? sortGames(filteredGames, sortKey, sortDirection) : undefined);

  let page = $state(1);
  $effect(() => {
    filters;
    sortKey;
    sortDirection;
    page = 1;
  });
  const totalPages = $derived(pageCount(sortedGames?.length ?? 0));
  const currentPage = $derived(clampPage(page, sortedGames?.length ?? 0));
  const pagedGames = $derived(sortedGames ? paginate(sortedGames, page) : undefined);

  let selected: Set<string> = $state(new Set());

  function toggleSelect(id: string): void {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selected = next;
  }

  function toggleSelectAll(): void {
    const pageIds = pagedGames?.map((g) => g.id) ?? [];
    const allSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
    const next = new Set(selected);
    for (const id of pageIds) {
      if (allSelected) next.delete(id);
      else next.add(id);
    }
    selected = next;
  }

  function clearSelection(): void {
    selected = new Set();
  }

  async function load(): Promise<void> {
    loadError = undefined;
    try {
      games = await apiGet<GameRow[]>("games");
    } catch (e) {
      loadError = e instanceof ApiError ? e.message : String(e);
    }
  }

  interface UsernameSyncResult {
    username: string;
    added: number;
    error?: string;
  }

  interface AutoSyncStatus {
    running: boolean;
    lastResults: UsernameSyncResult[];
  }

  async function pollUntilDone(): Promise<AutoSyncStatus> {
    while (true) {
      const status = await apiGet<AutoSyncStatus>("autosync/status");
      if (!status.running) return status;
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }

  function syncResultToast(status: AutoSyncStatus): void {
    const withErrors = status.lastResults.filter((r) => r.error);
    if (withErrors.length > 0) {
      showToast(`Sync problem: ${withErrors.map((r) => `${r.username}: ${r.error}`).join("; ")}`, "error");
      return;
    }
    const added = status.lastResults.reduce((sum, r) => sum + r.added, 0);
    showToast(added === 0 ? "No new games." : added === 1 ? "1 new game." : `${added} new games.`);
  }

  async function syncNow(): Promise<void> {
    syncing = true;
    try {
      await apiPost("autosync/sync-now");
      syncResultToast(await pollUntilDone());
      await load();
    } catch (e) {
      showToast(`Sync failed: ${e instanceof ApiError ? e.message : String(e)}`, "error");
    } finally {
      syncing = false;
    }
  }

  load();

  const countLine = $derived(
    filteredGames === undefined
      ? ""
      : `${filteredGames.length} ${filteredGames.length === 1 ? "game" : "games"}${filterCount > 0 ? " match your filters" : ""}`,
  );
</script>

<div class="page" class:with-bulk-bar={selected.size > 0}>
  <div class="heading-row">
    <div>
      <h1><Logo />Games</h1>
      <p class="count-line" aria-live="polite">{countLine}</p>
    </div>
    <div class="heading-actions">
      <button
        type="button"
        class="icon-button"
        class:spinning={syncing}
        onclick={syncNow}
        disabled={syncing}
        aria-label={syncing ? "Syncing games…" : "Sync games now"}
        title="Fetch new games from chess.com"
      >
        <Icon name="sync" />
      </button>
      <a href="#/import" class="import-button phone-only"><Icon name="import" size={18} />Import</a>
    </div>
  </div>

  {#if games === undefined && loadError === undefined}
    <p class="status-line">Loading games…</p>
  {:else if loadError}
    <div class="error-card" role="alert">
      <h2>Could not load games</h2>
      <p>{loadError}</p>
      <button type="button" onclick={load}>Try again</button>
    </div>
  {:else if games && games.length === 0}
    <div class="empty-card">
      <h2>Import your first games</h2>
      <p class="muted">Pick a source. All three end in the same report.</p>
      <a href="#/import">Upload PGN files, paste PGN text, or fetch by username</a>
    </div>
  {:else if games && filteredGames}
    <div class="toolbar">
      <div class="search-box">
        <input
          type="search"
          aria-label="Search opponent or opening"
          placeholder="Search games"
          value={searchInput}
          oninput={(e) => onSearchInput(e.currentTarget.value)}
        />
      </div>
      <button type="button" class="filters-toggle phone-only" onclick={() => (showFiltersPanel = !showFiltersPanel)}>
        <Icon name="filter" size={18} />Filters{filterCount > 0 ? ` (${filterCount})` : ""}
      </button>
    </div>

    <div class="filters-panel" class:hidden-on-phone={!showFiltersPanel}>
      <FilterPanel bind:filters {facets} />
    </div>

    {#if sortedGames && sortedGames.length === 0}
      <div class="empty-card">
        <p>No games match these filters.</p>
        <button type="button" onclick={() => (filters = defaultFilters())}>Clear all filters</button>
      </div>
    {:else if pagedGames}
      <GamesList
        games={pagedGames}
        {sortKey}
        {sortDirection}
        {onSort}
        {selected}
        onToggleSelect={toggleSelect}
        onToggleSelectAll={toggleSelectAll}
      />
      <nav class="pagination" aria-label="Pagination">
        <button type="button" disabled={currentPage === 1} onclick={() => (page = currentPage - 1)}>Previous</button>
        <span class="page-label">Page {currentPage} of {totalPages}</span>
        <button type="button" disabled={currentPage === totalPages} onclick={() => (page = currentPage + 1)}>Next</button>
      </nav>
    {/if}
  {/if}
</div>

{#if selected.size > 0}
  <div class="bulk-bar">
    <div class="bulk-bar-inner">
      <span class="bulk-count" aria-live="polite">{selected.size} selected</span>
      <button type="button" class="quiet" onclick={clearSelection}>Clear</button>
    </div>
  </div>
{/if}

<style>
  .page {
    max-width: 1280px;
    margin: 0 auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .heading-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
  }
  h1 {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 24px;
    line-height: 32px;
    font-weight: 600;
  }
  .count-line {
    color: var(--muted);
    font-size: 14px;
    margin-top: 4px;
  }
  .heading-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .icon-button {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    border: 1px solid var(--line);
    background: var(--surface);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }
  .icon-button:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
  .icon-button.spinning :global(svg) {
    animation: spin 1s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  .import-button {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    padding: 0 16px;
    border-radius: 12px;
    background: var(--brand);
    color: var(--brand-ink);
    text-decoration: none;
    font-size: 15px;
    font-weight: 500;
  }
  .phone-only {
    display: inline-flex;
  }
  @media (min-width: 768px) {
    .phone-only {
      display: none;
    }
  }
  .status-line {
    color: var(--muted);
    font-size: 14px;
  }
  .error-card,
  .empty-card {
    border: 1px solid var(--line);
    border-radius: 16px;
    padding: 16px;
    background: var(--surface);
  }
  .error-card {
    border-color: var(--danger);
  }
  .muted {
    color: var(--muted);
  }

  .toolbar {
    display: flex;
    gap: 8px;
  }
  .search-box {
    flex: 1;
  }
  .search-box input {
    width: 100%;
    min-height: 44px;
    padding: 0 12px;
    border: 1px solid var(--line);
    border-radius: 12px;
    background: var(--surface);
    color: var(--ink);
    font-size: 16px;
  }
  .filters-toggle {
    align-items: center;
    gap: 8px;
    min-height: 44px;
    padding: 0 16px;
    border: 1px solid var(--line);
    border-radius: 12px;
    background: var(--surface);
    font-size: 15px;
    cursor: pointer;
  }
  .filters-panel.hidden-on-phone {
    display: none;
  }
  @media (min-width: 768px) {
    .filters-panel.hidden-on-phone {
      display: block;
    }
  }

  .pagination {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .pagination button {
    min-height: 44px;
    padding: 0 16px;
    border: 1px solid var(--line);
    border-radius: 12px;
    background: var(--surface);
    font-size: 14px;
    cursor: pointer;
  }
  .pagination button:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
  .page-label {
    color: var(--muted);
    font-size: 14px;
  }

  .page.with-bulk-bar {
    padding-bottom: 80px;
  }
  .bulk-bar {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 56px; /* phone bottom tab bar */
    background: var(--surface);
    border-top: 1px solid var(--line);
    box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.12);
    padding: 8px 16px;
    z-index: 10;
  }
  @media (min-width: 768px) {
    .bulk-bar {
      bottom: 0;
    }
  }
  .bulk-bar-inner {
    max-width: 1280px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .bulk-count {
    font-size: 14px;
    font-weight: 500;
    margin-right: auto;
  }
  .bulk-bar button {
    min-height: 44px;
    padding: 0 16px;
    border-radius: 12px;
    font-size: 14px;
    cursor: pointer;
  }
  .bulk-bar button.quiet {
    border: none;
    background: none;
    color: var(--ink);
  }
</style>
