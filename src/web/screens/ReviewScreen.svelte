<script lang="ts">
  import { untrack } from "svelte";
  import Logo from "../components/Logo.svelte";
  import Icon from "../components/Icon.svelte";
  import Board from "../components/Board.svelte";
  import EvalBar from "../components/EvalBar.svelte";
  import Transport from "../components/Transport.svelte";
  import EvalGraph from "../components/EvalGraph.svelte";
  import GameReviewPanel from "../components/GameReviewPanel.svelte";
  import AnalysePanel from "../components/AnalysePanel.svelte";
  import Explanation from "../components/Explanation.svelte";
  import ExplorePanel from "../components/ExplorePanel.svelte";
  import BottomSheet from "../components/BottomSheet.svelte";
  import { viewport } from "../lib/viewport.svelte.ts";
  import { ExploreState } from "../lib/explore.svelte.ts";
  import { scoreTextFromLine, scoreTextFromWinPercent } from "../lib/scoreText.ts";
  import ResultBadge from "../components/ResultBadge.svelte";
  import { apiGet, ApiError } from "../lib/api.ts";
  import { navigate } from "../lib/router.svelte.ts";
  import { onGameAnalysed, liveEvalAt } from "../lib/live.svelte.ts";
  import { timeClassLabel, formatDate } from "../lib/format.ts";
  import { clampPly } from "../lib/ply.ts";
  import { CLASS_INFO } from "../../server/analysis/texts.ts";
  import type { GameReviewRow } from "../../server/games/reviewRow.ts";

  let { gameId, ply }: { gameId: string; ply: number } = $props();

  let game: GameReviewRow | undefined = $state();
  let notFound = $state(false);
  let loadError: string | undefined = $state(undefined);
  let flipped = $state(false);
  let playing = $state(false);
  let explore: ExploreState | undefined = $state();

  // docs/06-GAMES-SPEC.md section B10: the start position is the board's current ply; ends on leaving the screen.
  function startExploring(): void {
    if (explore || !fen) return;
    playing = false;
    explore = new ExploreState(fen, (fen.split(" ")[1] ?? "w") as "w" | "b");
  }

  function stopExploring(): void {
    explore?.destroy();
    explore = undefined;
  }

  function toggleExplore(): void {
    if (explore) stopExploring();
    else startExploring();
  }

  $effect(() => {
    gameId; // leaving for a different game also ends exploring
    return () => explore?.destroy();
  });

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

  // docs/06-GAMES-SPEC.md section B8: switch to the analysed view as soon as this game finishes, not just on the next poll.
  $effect(() => {
    const id = gameId;
    return onGameAnalysed((finishedId) => {
      if (finishedId === id) load();
    });
  });

  function goBack(): void {
    if (window.history.length > 1) window.history.back();
    else navigate("/games");
  }

  const plyCount = $derived(game?.positions.fens.length ? game.positions.fens.length - 1 : 0);
  const currentPly = $derived(clampPly(ply, plyCount));

  // docs/06-GAMES-SPEC.md section B1: the ply replaces, not adds, a history entry.
  // Section B10: jumping to a move (graph, move list, key moment) ends exploring.
  function jumpTo(p: number): void {
    playing = false;
    stopExploring();
    navigate(`/games/${encodeURIComponent(gameId)}/${clampPly(p, plyCount)}`, { replace: true });
  }

  function togglePlay(): void {
    if (currentPly >= plyCount) return;
    playing = !playing;
  }

  // docs/06-GAMES-SPEC.md section B5: advances one ply per second, stops at the last ply.
  $effect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      const next = untrack(() => currentPly) + 1;
      if (next > untrack(() => plyCount)) {
        playing = false;
        return;
      }
      navigate(`/games/${encodeURIComponent(gameId)}/${next}`, { replace: true });
    }, 1000);
    return () => clearInterval(timer);
  });

  // docs/06-GAMES-SPEC.md section B11: shortcuts are ignored while typing or with a modifier held.
  function isTyping(target: EventTarget | null): boolean {
    const el = target as HTMLElement | null;
    return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
  }

  function keepsOwnSpaceMeaning(target: EventTarget | null): boolean {
    const el = target as HTMLElement | null;
    if (!el) return false;
    if (["BUTTON", "A", "SUMMARY"].includes(el.tagName)) return true;
    const role = el.getAttribute("role");
    return role === "tab" || role === "slider";
  }

  // docs/06-GAMES-SPEC.md section B11: Escape leaves explore mode; Left arrow undoes instead of navigating;
  // Right arrow/Home/End/Space do nothing while exploring (F still flips the board either way).
  function onKeydown(e: KeyboardEvent): void {
    if (e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented || isTyping(e.target)) return;
    if (e.key === "Escape" && explore) {
      e.preventDefault();
      stopExploring();
    } else if (e.key === "f" || e.key === "F") {
      flipped = !flipped;
    } else if (explore) {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        explore.undo();
      }
    } else if (e.key === "ArrowLeft" && plyCount > 0) {
      e.preventDefault();
      jumpTo(currentPly - 1);
    } else if (e.key === "ArrowRight" && plyCount > 0) {
      e.preventDefault();
      jumpTo(currentPly + 1);
    } else if (e.key === "Home" && plyCount > 0) {
      e.preventDefault();
      jumpTo(0);
    } else if (e.key === "End" && plyCount > 0) {
      e.preventDefault();
      jumpTo(plyCount);
    } else if (e.key === " " && plyCount > 0 && !keepsOwnSpaceMeaning(e.target)) {
      e.preventDefault();
      togglePlay();
    }
  }

  $effect(() => {
    window.addEventListener("keydown", onKeydown);
    return () => window.removeEventListener("keydown", onKeydown);
  });

  const fen = $derived(game?.positions.fens[currentPly]);
  const lastMove = $derived(game?.positions.lastMoves[currentPly]);
  // docs/06-GAMES-SPEC.md section B3: my colour at the bottom by default; Flip inverts it for this visit.
  const baseOrientation = $derived(game?.myColour === "b" ? "black" : "white");
  const orientation = $derived(flipped ? (baseOrientation === "white" ? "black" : "white") : baseOrientation);

  // docs/06-GAMES-SPEC.md section B3: the move that produced the current position, analysed games only, ply >= 1.
  const currentMove = $derived(currentPly >= 1 ? game?.analysis?.moves[currentPly - 1] : undefined);
  const bestUci = $derived(currentMove?.bestLine?.pv[0]);

  const badge = $derived(
    currentMove && lastMove ? { square: lastMove.slice(2, 4), cls: currentMove.classification } : undefined,
  );

  const arrows = $derived.by(() => {
    if (!currentMove || !bestUci) return [];
    const shapes: { orig: string; dest: string; brush: "amber" | "green" }[] = [];
    if (bestUci !== currentMove.uci) shapes.push({ orig: currentMove.uci.slice(0, 2), dest: currentMove.uci.slice(2, 4), brush: "amber" });
    if (currentMove.classification !== "book") shapes.push({ orig: bestUci.slice(0, 2), dest: bestUci.slice(2, 4), brush: "green" });
    return shapes;
  });

  // docs/06-GAMES-SPEC.md section B3: the board's accessible name.
  const boardLabel = $derived.by(() => {
    if (currentPly === 0) return "Chess board, start position";
    if (!currentMove || !game) return `Chess board after ply ${currentPly}`;
    const moveNumber = Math.ceil(currentPly / 2);
    const moveText =
      currentMove.colour === "w" ? `${moveNumber}. ${currentMove.san}` : `${moveNumber}... ${currentMove.san}`;
    let label = `Chess board after ${moveText}`;
    if (game.analysis) {
      label += `, ${CLASS_INFO[currentMove.classification].label}`;
      if (currentMove.bestSan && currentMove.classification !== "best") {
        label += `. Best was ${currentMove.bestSan}`;
      }
    }
    return label;
  });

  // docs/06-GAMES-SPEC.md section B10: while exploring, the board shows the explored position instead -
  // no game badge/arrows, the explored last move and the best line's arrow, a fixed accessible name.
  const boardFen = $derived(explore ? explore.fen : (fen ?? "8/8/8/8/8/8/8/8 w - - 0 1"));
  const boardLastMove = $derived(explore ? explore.lastMove : lastMove);
  const boardBadge = $derived(explore ? undefined : badge);
  const boardArrows = $derived(explore ? (explore.bestMoveArrow ? [explore.bestMoveArrow] : []) : arrows);
  const boardLabelText = $derived(explore ? "Chess board, explore mode" : boardLabel);
  const boardMovable = $derived.by(() => {
    if (!explore) return undefined;
    return { colour: (explore.sideToMove === "w" ? "white" : "black") as "white" | "black", dests: explore.dests, onMove: (uci: string) => explore?.playMove(uci) };
  });

  // docs/06-GAMES-SPEC.md section B4: Win% for ply p = the stored "after" Win% of ply p (ply 0 = "before" of the first move).
  // Section B8: before the stored analysis arrives, the same array is filled from live per-ply values instead, with
  // gaps where none has arrived yet, so the eval bar and graph fill in as the engine goes.
  const winPercents = $derived.by(() => {
    if (!game) return [];
    const moves = game.analysis?.moves;
    if (moves && moves.length > 0) return [moves[0]!.winPercentBefore, ...moves.map((m) => m.winPercentAfter)];
    return Array.from({ length: plyCount + 1 }, (_, ply) => liveEvalAt(gameId, ply));
  });
  const classifications = $derived.by(() => {
    const moves = game?.analysis?.moves;
    if (!moves || moves.length === 0) return [];
    return [undefined, ...moves.map((m) => m.classification)];
  });
  const winPercent = $derived(winPercents[currentPly]);

  // The score of the best line of the next move; for the last ply, derived from Win% instead.
  const scoreText = $derived.by(() => {
    const moves = game?.analysis?.moves;
    if (!moves) return "–";
    if (currentPly < plyCount) return scoreTextFromLine(moves[currentPly]?.bestLine);
    return winPercent !== undefined ? scoreTextFromWinPercent(winPercent) : "–";
  });

  // docs/06-GAMES-SPEC.md section B10: the eval bar follows the explored position's best line instead;
  // a finished position shows the fixed result text, keeping the last known value otherwise.
  const evalWinPercent = $derived(explore ? explore.lastWinPercent : winPercent);
  const evalScoreText = $derived.by(() => {
    if (!explore) return scoreText;
    if (explore.gameOver) return explore.gameOver.type === "checkmate" ? (explore.gameOver.winner === "w" ? "1-0" : "0-1") : "½";
    return scoreTextFromLine(explore.lines[0]);
  });

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
      <button
        type="button"
        class="explore-toggle"
        class:active={!!explore}
        aria-label="Explore"
        aria-pressed={!!explore}
        title="Explore moves from this position with live engine lines"
        disabled={plyCount === 0}
        onclick={toggleExplore}
      >
        <Icon name="explore" size={18} />
        <span class="explore-label" aria-hidden="true">Explore</span>
      </button>
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
    <!-- docs/06-GAMES-SPEC.md section B9: desktop puts the board+transport and the info/graph/tabs side by
         side in two columns; phone stacks them, with the graph+tabs in a collapsible bottom sheet. -->
    <div class="board-area">
      <div class="board-column">
        <EvalBar winPercent={evalWinPercent} scoreText={evalScoreText} flipped={orientation === "black"} />
        <Board
          fen={boardFen}
          {orientation}
          lastMove={boardLastMove}
          arrows={boardArrows}
          badge={boardBadge}
          label={boardLabelText}
          movable={boardMovable}
        />
        <Transport
          {currentPly}
          {plyCount}
          {playing}
          disabled={plyCount === 0 || !!explore}
          onFirst={() => jumpTo(0)}
          onPrevious={() => jumpTo(currentPly - 1)}
          onTogglePlay={togglePlay}
          onNext={() => jumpTo(currentPly + 1)}
          onLast={() => jumpTo(plyCount)}
        />
      </div>
      <div class="info-column">
        <!-- The info card is the Explanation, the Analyse panel (unanalysed) or the Explore panel; the
             graph and the tabs below it are always visible either way. -->
        {#if explore}
          <ExplorePanel {explore} onBackToGame={stopExploring} />
        {:else if game.analysis || plyCount === 0}
          <Explanation {game} {currentPly} {plyCount} />
        {:else}
          <!-- game.analysisStatus is never "done" here: "done" implies game.analysis is set (docs/06-GAMES-SPEC.md B8). -->
          <AnalysePanel gameId={game.id} analysisStatus={game.analysisStatus as "none" | "queued" | "running" | "error"} onQueued={load} />
        {/if}
        {#if viewport.isDesktop}
          <EvalGraph {winPercents} {classifications} {currentPly} onJump={jumpTo} />
          <GameReviewPanel
            {game}
            sans={game.positions.sans}
            analysisMoves={game.analysis?.moves}
            keyMoments={game.analysis?.summary.keyMoments}
            {currentPly}
            onJump={jumpTo}
          />
        {:else}
          <BottomSheet
            {game}
            sans={game.positions.sans}
            analysisMoves={game.analysis?.moves}
            keyMoments={game.analysis?.summary.keyMoments}
            {winPercents}
            {classifications}
            {currentPly}
            {plyCount}
            {playing}
            exploring={!!explore}
            onJump={jumpTo}
            onFirst={() => jumpTo(0)}
            onPrevious={() => jumpTo(currentPly - 1)}
            onTogglePlay={togglePlay}
            onNext={() => jumpTo(currentPly + 1)}
            onLast={() => jumpTo(plyCount)}
          />
        {/if}
      </div>
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
  .explore-toggle {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 44px;
    padding: 0 12px;
    border: 1px solid var(--line);
    border-radius: 12px;
    background: var(--surface);
    color: var(--ink);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    flex: none;
  }
  .explore-toggle.active {
    border-color: var(--brand);
    background: var(--brand);
    color: var(--brand-ink);
  }
  .explore-label {
    display: none;
  }
  @media (min-width: 768px) {
    .explore-label {
      display: inline;
    }
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
  .board-column {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
  }
  .info-column {
    margin-top: 16px;
  }
  @media (min-width: 768px) {
    /* docs/07-UI-SPEC.md section 8.3: a mini-grid of eval bar + board; the transport sits under the board only. */
    .board-column > :global(.transport) {
      grid-column: 2;
    }
    .board-area {
      max-width: 1200px;
      display: flex;
      align-items: flex-start;
      gap: 24px;
    }
    .board-column {
      flex: none;
      width: 560px;
      grid-template-columns: auto minmax(0, 1fr);
      gap: 12px 8px;
    }
    .info-column {
      flex: 1;
      min-width: 0;
      margin-top: 0;
    }
  }
</style>
