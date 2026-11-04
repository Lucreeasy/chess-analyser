<script lang="ts">
  import Logo from "../components/Logo.svelte";
  import Icon from "../components/Icon.svelte";
  import GamesList from "../components/GamesList.svelte";
  import { apiGet, apiPost, ApiError } from "../lib/api.ts";
  import type { GameRow } from "../lib/types.ts";

  let games: GameRow[] | undefined = $state(undefined);
  let loadError: string | undefined = $state(undefined);
  let syncing = $state(false);
  let syncError: string | undefined = $state(undefined);

  async function load(): Promise<void> {
    loadError = undefined;
    try {
      games = await apiGet<GameRow[]>("games");
    } catch (e) {
      loadError = e instanceof ApiError ? e.message : String(e);
    }
  }

  interface AutoSyncStatus {
    running: boolean;
  }

  async function pollWhileSyncing(): Promise<void> {
    while (true) {
      const status = await apiGet<AutoSyncStatus>("autosync/status");
      if (!status.running) break;
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }

  async function syncNow(): Promise<void> {
    syncing = true;
    syncError = undefined;
    try {
      await apiPost("autosync/sync-now");
      await pollWhileSyncing();
      await load();
    } catch (e) {
      syncError = e instanceof ApiError ? e.message : String(e);
    } finally {
      syncing = false;
    }
  }

  load();

  const countLine = $derived(games === undefined ? "" : `${games.length} ${games.length === 1 ? "game" : "games"}`);
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

  {#if syncError}
    <p class="error-line" role="alert">Sync failed: {syncError}</p>
  {/if}

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
  {:else if games}
    <GamesList {games} />
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
  .status-line,
  .error-line {
    color: var(--muted);
    font-size: 14px;
  }
  .error-line {
    color: var(--danger);
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
</style>
