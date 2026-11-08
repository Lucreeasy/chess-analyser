<script lang="ts">
  import Logo from "../components/Logo.svelte";
  import Icon from "../components/Icon.svelte";
  import GamesList from "../components/GamesList.svelte";
  import FilterPanel from "../components/FilterPanel.svelte";
  import ConfirmDialog from "../components/ConfirmDialog.svelte";
  import { apiGet, apiPost, ApiError } from "../lib/api.ts";
  import { showToast } from "../lib/toasts.svelte.ts";
  import { defaultFilters, filterGames, activeFilterCount, computeFacets, filtersFromQuery, type GamesFilters } from "../lib/gamesFilter.ts";
  import { route } from "../lib/router.svelte.ts";
  import { plural } from "../lib/format.ts";
  import { sortGames, FIRST_DIRECTION, type SortKey, type SortDirection } from "../lib/gamesSort.ts";
  import { paginate, pageCount, clampPage } from "../lib/paginate.ts";
  import { onGamesChanged } from "../lib/live.svelte.ts";
  import { SEARCH_DEPTH, oneStepDeeper } from "../../server/analysisQueue/depthPresets.ts";
  import type { DepthPreset } from "../../server/settings.ts";
  import type { GameRow } from "../lib/types.ts";

  let games: GameRow[] | undefined = $state(undefined);
  let loadError: string | undefined = $state(undefined);
  let syncing = $state(false);
  let defaultDepth: DepthPreset = $state("standard");

  apiGet<{ depthPreset: DepthPreset }>("settings")
    .then((s) => (defaultDepth = s.depthPreset))
    .catch(() => {});

  const deeperDepth = $derived(oneStepDeeper(defaultDepth));
  const deeperTooltip = $derived(`Depth ${SEARCH_DEPTH[deeperDepth]} (${deeperDepth})`);

  let filters: GamesFilters = $state(defaultFilters());
  // docs/06-GAMES-SPEC.md section A8: a link from Insights carries filters, ids and a label in the address.
  $effect(() => {
    filters = filtersFromQuery(route.path.split("?")[1] ?? "");
  });

  /** A8 "Clear": with an id list drop it and the label, keeping the other filters; otherwise clear all filters. */
  function clearInsightsFilter(): void {
    filters = filters.ids ? { ...filters, ids: undefined, label: undefined, approximate: false } : defaultFilters();
    history.replaceState(null, "", "#/games"); // the address no longer holds the drill-down, without re-reading it
  }
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

  let queuing = $state(false);

  async function queueSelected(deeper: boolean): Promise<void> {
    queuing = true;
    const n = selected.size;
    try {
      await apiPost("analyse/queue", { gameIds: [...selected], ...(deeper ? { deeper: true } : {}) });
      showToast(
        deeper
          ? n === 1
            ? "Queued 1 game for deeper analysis."
            : `Queued ${n} games for deeper analysis.`
          : n === 1
            ? "Queued 1 game for analysis."
            : `Queued ${n} games for analysis.`,
      );
      clearSelection();
      await load();
    } catch (e) {
      showToast(`Could not queue analysis: ${e instanceof ApiError ? e.message : String(e)}`, "error");
    } finally {
      queuing = false;
    }
  }

  let showDeleteConfirm = $state(false);
  let deleting = $state(false);

  async function confirmDelete(): Promise<void> {
    deleting = true;
    const ids = [...selected];
    try {
      const result = await apiPost<{ deleted: number }>("games/delete", { ids });
      showToast(result.deleted === 1 ? "Deleted 1 game." : `Deleted ${result.deleted} games.`);
      clearSelection();
      showDeleteConfirm = false;
      await load();
    } catch (e) {
      showDeleteConfirm = false;
      showToast(`Could not delete: ${e instanceof ApiError ? e.message : String(e)}`, "error");
    } finally {
      deleting = false;
    }
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
  $effect(() => onGamesChanged(load));

  const countLine = $derived(
    filteredGames === undefined
      ? ""
      : `${filteredGames.length} ${filteredGames.length === 1 ? "game" : "games"}${filterCount > 0 ? " match your filters" : ""}`,
  );
</script>

<div class="page" class:with-bulk-bar={selected.size > 0}>
  <div class="heading-row">
    <div>
      <h1 class="page-title"><Logo />Games</h1>
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
    <div class="card">
      <h2>Import your first games</h2>
      <p class="muted">Pick a source. All three end in the same report.</p>
      <ul class="import-sources">
        <li>
          <a href="#/import/file">
            <Icon name="file" size={24} />
            <span>
              <strong>Upload PGN files</strong>
              <span class="muted">From chess.com's archive download.</span>
            </span>
          </a>
        </li>
        <li>
          <a href="#/import/paste">
            <Icon name="clipboard" size={24} />
            <span>
              <strong>Paste PGN text</strong>
              <span class="muted">One game or a whole export.</span>
            </span>
          </a>
        </li>
        <li>
          <a href="#/import/username">
            <Icon name="user" size={24} />
            <span>
              <strong>Fetch by username</strong>
              <span class="muted">Pick months straight from chess.com.</span>
            </span>
          </a>
        </li>
      </ul>
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

    {#if filters.ids || filters.label}
      <div class="from-insights" role="status">
        <p>
          Showing {filteredGames ? plural(filteredGames.length, "game") : "…"} from Insights{filters.label ? `: ${filters.label}` : ""}
          {#if filters.approximate}
            <span class="muted">Filters only: the exact list was too long to link, so this may include a few more games.</span>
          {/if}
        </p>
        <button type="button" class="neutral" aria-label="Remove the Insights filter and show all games" onclick={clearInsightsFilter}>Clear</button>
      </div>
    {/if}

    <div class="filters-panel" class:hidden-on-phone={!showFiltersPanel}>
      <FilterPanel bind:filters {facets} />
    </div>

    {#if sortedGames && sortedGames.length === 0}
      <div class="card">
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
  <div class="bulk-bar" role="region" aria-label="Bulk actions">
    <div class="bulk-bar-inner">
      <span class="bulk-count" aria-live="polite">{selected.size} selected</span>
      <button type="button" class="primary" disabled={queuing} onclick={() => queueSelected(false)}>Analyse selected</button>
      <button type="button" disabled={queuing} title={deeperTooltip} onclick={() => queueSelected(true)}>Re-analyse deeper</button>
      <button type="button" class="danger-text" onclick={() => (showDeleteConfirm = true)}>Delete</button>
      <button type="button" class="quiet" onclick={clearSelection}>Clear</button>
    </div>
  </div>
{/if}

{#if showDeleteConfirm}
  <ConfirmDialog
    title={selected.size === 1 ? "Delete 1 game?" : `Delete ${selected.size} games?`}
    body={selected.size === 1
      ? "The game and its analysis are removed from this app. This cannot be undone. You can import them again later."
      : "The games and their analysis are removed from this app. This cannot be undone. You can import them again later."}
    confirmLabel="Delete"
    busyLabel="Deleting…"
    busy={deleting}
    danger
    onConfirm={confirmDelete}
    onCancel={() => (showDeleteConfirm = false)}
  />
{/if}

<style>
  .page {
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
  .error-card {
    margin-top: 0; /* the page's flex gap spaces it */
  }
  .muted {
    color: var(--muted);
  }

  .import-sources {
    list-style: none;
    margin: 16px 0 0;
    padding: 0;
    display: grid;
    gap: 8px;
  }
  .import-sources a {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 64px;
    padding: 10px 12px;
    border: 1px solid var(--line);
    border-radius: 12px;
    color: var(--ink);
    text-decoration: none;
  }
  .import-sources a > span {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 14px;
  }
  .import-sources a .muted {
    font-size: 13px;
  }
  @media (min-width: 768px) {
    .import-sources {
      grid-template-columns: repeat(3, 1fr);
    }
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
  .from-insights {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 4px 4px 4px 16px;
    border: 1px solid var(--brand);
    border-radius: 16px;
    background: var(--surface-2);
    font-size: 14px;
  }
  .from-insights .muted {
    display: block;
    margin: 2px 0 0;
  }
  .from-insights button {
    margin-top: 0;
    flex: none;
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
    border: 1px solid var(--line);
    background: var(--surface);
    color: var(--ink);
    cursor: pointer;
  }
  .bulk-bar button:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
  .bulk-bar button.primary {
    border-color: var(--brand);
    background: var(--brand);
    color: var(--brand-ink);
  }
  .bulk-bar button.quiet {
    border: none;
    background: none;
    color: var(--ink);
  }
  .bulk-bar button.danger-text {
    color: var(--danger);
  }
</style>
