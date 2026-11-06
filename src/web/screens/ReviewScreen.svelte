<script lang="ts">
  import Logo from "../components/Logo.svelte";
  import Icon from "../components/Icon.svelte";
  import Board from "../components/Board.svelte";
  import ResultBadge from "../components/ResultBadge.svelte";
  import { apiGet, ApiError } from "../lib/api.ts";
  import { navigate } from "../lib/router.svelte.ts";
  import { timeClassLabel, formatDate } from "../lib/format.ts";
  import type { GameReviewRow } from "../../server/games/reviewRow.ts";

  let { gameId, ply }: { gameId: string; ply: number } = $props();

  let game: GameReviewRow | undefined = $state();
  let notFound = $state(false);
  let loadError: string | undefined = $state(undefined);
  let flipped = $state(false);

  async function load(): Promise<void> {
    notFound = false;
    loadError = undefined;
    try {
      game = await apiGet<GameReviewRow>(`games/${encodeURIComponent(gameId)}`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) notFound = true;
      else loadError = e instanceof ApiError ? e.message : "unexpected error";
    }
  }

  load();

  // docs/06-GAMES-SPEC.md section B1: re-fetch every 4s while the game has no analysis yet and is queued/running.
  $effect(() => {
    if (game?.analysisStatus !== "queued" && game?.analysisStatus !== "running") return;
    const timer = setInterval(load, 4000);
    return () => clearInterval(timer);
  });

  function goBack(): void {
    if (window.history.length > 1) window.history.back();
    else navigate("/games");
  }

  // docs/06-GAMES-SPEC.md section B11: shortcuts are ignored while typing or with a modifier held.
  function isTyping(target: EventTarget | null): boolean {
    const el = target as HTMLElement | null;
    return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
  }

  function onKeydown(e: KeyboardEvent): void {
    if (e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented || isTyping(e.target)) return;
    if (e.key === "f" || e.key === "F") flipped = !flipped;
  }

  $effect(() => {
    window.addEventListener("keydown", onKeydown);
    return () => window.removeEventListener("keydown", onKeydown);
  });

  const plyCount = $derived(game?.positions.fens.length ? game.positions.fens.length - 1 : 0);
  const currentPly = $derived(Math.max(0, Math.min(ply, plyCount)));
  const fen = $derived(game?.positions.fens[currentPly]);
  const lastMove = $derived(game?.positions.lastMoves[currentPly]);
  // docs/06-GAMES-SPEC.md section B3: my colour at the bottom by default; Flip inverts it for this visit.
  const baseOrientation = $derived(game?.myColour === "b" ? "black" : "white");
  const orientation = $derived(flipped ? (baseOrientation === "white" ? "black" : "white") : baseOrientation);

  const whiteTitle = $derived(game ? (game.whiteElo ? `${game.white} (${game.whiteElo})` : game.white) : "");
  const blackTitle = $derived(game ? (game.blackElo ? `${game.black} (${game.blackElo})` : game.black) : "");

  const subLine = $derived.by(() => {
    if (!game) return "";
    const timeControl = `${timeClassLabel(game.timeClass)} ${game.timeControlText}`.trim();
    const opening = game.openingName ?? game.eco;
    return [game.result, timeControl, opening].filter(Boolean).join(" · ");
  });

  const subLineTooltip = $derived(game ? `${subLine} · ${formatDate(game.playedAt)}` : "");
</script>

<div class="screen">
  <header class="header">
    <button type="button" class="back" onclick={goBack} aria-label="Back to games">
      <Icon name="chevron" size={20} />
    </button>
    {#if game}
      <div class="titles">
        <h1><Logo />{whiteTitle} <span class="vs">vs</span> {blackTitle}</h1>
        <p class="sub-line" title={subLineTooltip}>{subLine}</p>
      </div>
      <div class="badge-slot">
        <ResultBadge myResult={game.myResult} result={game.result} />
      </div>
      <button type="button" class="flip" onclick={() => (flipped = !flipped)} aria-label="Flip board" title="Flip board (F)">
        <Icon name="flip" size={18} />
      </button>
    {/if}
  </header>

  {#if notFound}
    <div class="error-card" role="alert">
      <h2>Game not found</h2>
      <p>It may have been deleted. Go back to the library to pick another one.</p>
      <a href="#/games">Back to games</a>
    </div>
  {:else if loadError}
    <div class="error-card" role="alert">
      <h2>Could not load this game</h2>
      <p>{loadError}</p>
      <div class="actions">
        <button type="button" onclick={load}>Try again</button>
        <a href="#/games">Back to games</a>
      </div>
    </div>
  {:else if game === undefined}
    <p class="status-line">Loading game…</p>
  {:else}
    <div class="board-area">
      <Board fen={fen ?? "8/8/8/8/8/8/8/8 w - - 0 1"} {orientation} {lastMove} />
    </div>
  {/if}
</div>

<style>
  .screen {
    max-width: 1280px;
    margin: 0 auto;
    padding: 16px;
  }
  .header {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .back,
  .flip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border: 1px solid var(--line);
    border-radius: 12px;
    background: var(--surface);
    color: var(--ink);
    cursor: pointer;
    flex: none;
  }
  .back :global(svg) {
    transform: rotate(90deg);
  }
  .titles {
    flex: 1;
    min-width: 0;
  }
  h1 {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 15px;
    font-weight: 600;
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .vs {
    font-weight: 400;
    color: var(--muted);
  }
  .sub-line {
    margin: 2px 0 0;
    font-size: 12px;
    color: var(--muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .badge-slot {
    display: none;
  }
  @media (min-width: 640px) {
    .badge-slot {
      display: block;
    }
  }
  .status-line {
    margin-top: 32px;
    color: var(--muted);
  }
  .error-card {
    margin-top: 16px;
    border: 1px solid var(--danger);
    border-radius: 16px;
    padding: 16px;
    background: var(--surface);
  }
  .error-card h2 {
    font-size: 16px;
    margin: 0 0 8px;
  }
  .error-card .actions {
    display: flex;
    gap: 8px;
    margin-top: 12px;
  }
  .board-area {
    max-width: 560px;
    margin: 16px auto 0;
  }
</style>
