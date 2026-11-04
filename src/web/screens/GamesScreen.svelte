<script lang="ts">
  import Logo from "../components/Logo.svelte";
  import Icon from "../components/Icon.svelte";
  import GamesList from "../components/GamesList.svelte";
  import FilterPanel from "../components/FilterPanel.svelte";
  import { apiGet, apiPost, ApiError } from "../lib/api.ts";
  import { showToast } from "../lib/toasts.svelte.ts";
  import { defaultFilters, filterGames, activeFilterCount, computeFacets, type GamesFilters } from "../lib/gamesFilter.ts";
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

<div class="page">
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

    {#if filteredGames.length === 0}
      <div class="empty-card">
        <p>No games match these filters.</p>
        <button type="button" onclick={() => (filters = defaultFilters())}>Clear all filters</button>
      </div>
    {:else}
      <GamesList games={filteredGames} />
    {/if}
  {/if}
</div>

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
</style>
