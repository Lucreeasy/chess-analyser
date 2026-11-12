<script lang="ts">
  import { tick } from "svelte";
  import type { listView } from "../../server/puzzles/list.ts";
  import type { checkAnswer } from "../../server/puzzles/check.ts";
  import type { MoveResult } from "../../server/explore/position.ts";
  import { apiGet, apiPost } from "../lib/api.ts";
  import { navigate, routeQuery } from "../lib/router.svelte.ts";
  import { provenance, relativeTime, scheduleNote } from "../lib/puzzleText.ts";
  import { capitalise, plural } from "../lib/format.ts";
  import { showToast } from "../lib/toasts.svelte.ts";
  import { queue, onGameAnalysed } from "../lib/live.svelte.ts";
  import { queueVisible } from "../lib/queueStatus.ts";
  import { ALL_TAGS } from "../../server/analysis/tacticTags.ts";
  import { ALL_PHASES } from "../../server/analysis/phases.ts";
  import { TAG_INFO } from "../../server/analysis/texts.ts";
  import Board from "../components/Board.svelte";
  import Logo from "../components/Logo.svelte";
  import Icon from "../components/Icon.svelte";
  import ColourMarker from "../components/ColourMarker.svelte";

  type View = ReturnType<typeof listView> & { analysedGames: number };
  /** The GET /api/puzzles route adds each item's opponent from its game (listView itself has no games). */
  type Item = View["items"][number] & { opponent?: string };
  type Answer = NonNullable<Awaited<ReturnType<typeof checkAnswer>>["result"]>;

  // The view lives in the address: "?mode=all", "&tag=…", "&phase=…"; unknown values are ignored.
  const query = $derived(routeQuery());
  const params = $derived(new URLSearchParams(query));
  const mode = $derived(params.get("mode") === "all" ? "all" : "due");
  const tag = $derived([...ALL_TAGS, "none"].find((t) => t === params.get("tag")));
  const phase = $derived(ALL_PHASES.find((p) => p === params.get("phase")));
  const filterCount = $derived((tag ? 1 : 0) + (phase ? 1 : 0));
  function show(next: { mode?: string; tag?: string; phase?: string }): void {
    const p = new URLSearchParams(Object.entries(next).filter(([k, v]) => v && !(k === "mode" && v === "due")));
    navigate(`/puzzles${p.size ? `?${p}` : ""}`);
  }
  const setMode = (m: "due" | "all") => show({ mode: m, tag, phase });
  let showFilters = $state(false);
  const TAG_LABEL: Record<string, string> = { ...Object.fromEntries(ALL_TAGS.map((t) => [t, TAG_INFO[t].label])), none: "Other" };

  // A run: one pass through a fetched list; puzzles shown or skipped are not offered again in it.
  let view: View | undefined = $state();
  let list: Item[] = $state([]);
  let seen = $state(new Set<string>());
  let skipped = $state(0);
  let loading = $state(true);
  let loadError: string | undefined = $state();
  const current = $derived(list.find((p) => !seen.has(p.id)));

  /** The list request of the current view; `limit: "0"` asks for counts and facets only. */
  const listUrl = (extra: Record<string, string> = {}) =>
    `puzzles?${new URLSearchParams({ mode, ...(tag && { tag }), ...(phase && { phase }), ...extra })}`;

  async function fetchList(): Promise<void> {
    loading = true;
    loadError = undefined;
    try {
      view = await apiGet<View>(listUrl());
      list = view.items as Item[];
    } catch (e) {
      loadError = e instanceof Error ? e.message : String(e);
    } finally {
      loading = false;
    }
  }
  async function refreshStats(): Promise<void> {
    view = await apiGet<View>(listUrl({ limit: "0" }));
  }
  function startRun(): void {
    seen = new Set();
    skipped = 0;
    fetchList();
  }
  $effect(() => {
    void query; // a new run whenever the view in the address changes
    startRun();
  });
  // A finished analysis can bring new puzzles: fresh counts, and a fresh list when nothing is on screen.
  $effect(() =>
    onGameAnalysed(() => {
      refreshStats();
      if (!current) fetchList();
    }),
  );

  let refreshing = $state(false);
  async function refresh(): Promise<void> {
    refreshing = true;
    try {
      const r = await apiPost<{ created: number; total: number }>("puzzles/refresh");
      showToast(r.created > 0 ? `Puzzles refreshed: ${r.created} new, ${r.total} in total.` : `Puzzles are up to date (${r.total} in total).`);
      startRun();
    } catch (e) {
      showToast(`Could not refresh puzzles: ${e instanceof Error ? e.message : String(e)}`, "error");
    } finally {
      refreshing = false;
    }
  }

  // The current puzzle: asking, checking a move, or answered.
  let stage: "ask" | "checking" | "answered" = $state("ask");
  let dests: Record<string, string[]> = $state({});
  let attempt: { uci: string; fen: string } | undefined = $state();
  let answer: Answer | undefined = $state();
  let checkError: string | undefined = $state();
  let showLine = $state(false);
  let prompt: HTMLElement | undefined = $state();
  let nextButton: HTMLElement | undefined = $state();

  $effect(() => {
    const p = current;
    if (!p) return;
    stage = "ask";
    attempt = undefined;
    answer = undefined;
    checkError = undefined;
    showLine = false;
    dests = {};
    apiGet<Record<string, string[]>>(`explore/dests?fen=${encodeURIComponent(p.fen)}`).then((d) => {
      if (current === p) dests = d;
    });
  });

  async function submit(body: { move: string } | { giveUp: true }): Promise<void> {
    const p = current!;
    stage = "checking";
    checkError = undefined;
    try {
      if ("move" in body) {
        const moved = await apiPost<MoveResult>("explore/move", { fen: p.fen, uci: body.move });
        attempt = { uci: body.move, fen: moved.fen! };
      }
      answer = await apiPost<Answer>(`puzzles/${p.id}/attempt`, body);
      stage = "answered";
      refreshStats();
      await tick();
      nextButton?.focus();
    } catch (e) {
      attempt = undefined;
      stage = "ask";
      checkError = e instanceof Error ? e.message : String(e);
    }
  }

  /** Next or Skip: the puzzle counts as seen; past the last one the list is fetched again. */
  async function moveOn(skip = false): Promise<void> {
    if (skip) skipped++;
    seen = new Set(seen).add(current!.id);
    if (!list.some((p) => !seen.has(p.id))) await fetchList();
    await tick();
    prompt?.focus();
  }

  const mover = $derived(current?.fen.split(" ")[1] === "b" ? "b" : "w");
  const side = $derived(mover === "w" ? "White" : "Black");
  const verdict = $derived(
    !answer
      ? undefined
      : !attempt
        ? { text: "Solution", tone: "plain", icon: "alert" as const }
        : answer.acceptedBy === "solution"
          ? { text: "Correct", tone: "ok", icon: "check" as const }
          : answer.acceptedBy === "tolerance"
            ? { text: "Correct, within tolerance", tone: "ok", icon: "check" as const }
            : { text: "Not the best move", tone: "danger", icon: "close" as const },
  );
  const note = $derived(answer ? scheduleNote(answer, Date.now()) : "");
  // Correct: the position after the move. Wrong or given up: the puzzle position with the solution arrows.
  const showsAttempt = $derived(!!attempt && (stage === "checking" || !!answer?.correct));
  const arrows = $derived(
    answer && !answer.correct
      ? [
          ...answer.solution.map((m) => ({ orig: m.slice(0, 2), dest: m.slice(2, 4), brush: "green" as const })),
          ...(attempt ? [{ orig: attempt.uci.slice(0, 2), dest: attempt.uci.slice(2, 4), brush: "amber" as const }] : []),
        ]
      : [],
  );
</script>

<svelte:window
  onkeydown={(e) => {
    const typing = e.target instanceof HTMLElement && e.target.closest("input, textarea, select");
    if (e.key.toLowerCase() === "n" && answer && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) moveOn();
  }}
/>

<div class="puzzles" class:no-board={!current}>
  <h1 class="sr-only">Puzzles</h1>
  {#if current}
    <div class="board">
      <Board
        fen={showsAttempt ? attempt!.fen : current.fen}
        orientation={mover === "w" ? "white" : "black"}
        lastMove={showsAttempt ? attempt!.uci : undefined}
        {arrows}
        label={`Puzzle board. ${side} to move.`}
        movable={stage === "ask" ? { colour: mover === "w" ? "white" : "black", dests, onMove: (uci) => submit({ move: uci }) } : undefined}
      />
    </div>
  {/if}

  <div class="side">
    <div class="strip">
      <Logo />
      <div class="segmented" role="radiogroup" aria-label="Which puzzles">
        {#each [["due", "Due"], ["all", "All"]] as const as [value, text] (value)}
          <label class="segment" class:selected={mode === value}>
            <input type="radio" name="puzzle-mode" checked={mode === value} onchange={() => setMode(value)} />
            {text}
          </label>
        {/each}
      </div>
      <button type="button" class="neutral filters" aria-expanded={showFilters} aria-controls="puzzle-filters" onclick={() => (showFilters = !showFilters)}>
        <Icon name="filter" size={18} />Filters{filterCount > 0 ? ` (${filterCount})` : ""}
      </button>
    </div>
    <p class="muted stats" aria-live="polite">
      {#if view}<strong>{view.counts.due}</strong> due · {view.counts.total} total · {view.counts.solved} solved{:else}Loading…{/if}
    </p>

    {#if showFilters && view}
      <div class="card filter-card" id="puzzle-filters">
        <p class="label">Tactic</p>
        <div class="chips">
          <button type="button" class="chip" aria-pressed={!tag} onclick={() => show({ mode, phase })}>Any tactic</button>
          {#each view.tagFacets as f (f.key)}
            <button type="button" class="chip" aria-pressed={tag === f.key} onclick={() => show({ mode, tag: tag === f.key ? undefined : f.key, phase })}>
              {TAG_LABEL[f.key]} ({f.count})
            </button>
          {/each}
        </div>
        <p class="label">Phase</p>
        <div class="chips">
          <button type="button" class="chip" aria-pressed={!phase} onclick={() => show({ mode, tag })}>Any phase</button>
          {#each view.phaseFacets as f (f.key)}
            <button type="button" class="chip" aria-pressed={phase === f.key} onclick={() => show({ mode, tag, phase: phase === f.key ? undefined : f.key })}>
              {capitalise(f.key)} ({f.count})
            </button>
          {/each}
        </div>
        <div class="actions">
          {#if filterCount > 0}<button type="button" class="neutral small" onclick={() => show({ mode })}>Clear filters</button>{/if}
          <button type="button" class="neutral small" class:spinning={refreshing} disabled={refreshing} onclick={refresh}>
            {refreshing ? "Refreshing…" : "Refresh puzzles"}
          </button>
        </div>
      </div>
    {/if}

    {#if current}
      <section class="panel">
        <h2 tabindex="-1" bind:this={prompt}><ColourMarker colour={mover} text={`Find the best move for ${side}`} size={20} /></h2>
        <p class="muted">{provenance(current)}</p>

        <div aria-live="polite">
          {#if stage === "checking"}
            <p class="spinning checking"><Icon name="sync" size={16} />Checking your move…</p>
          {:else if answer && verdict}
            <div class="card verdict {verdict.tone}">
              <p class="verdict-line"><Icon name={verdict.icon} size={18} /><strong>{verdict.text}</strong></p>
              <p>{answer.explanation}</p>
              {#if verdict.text !== "Correct"}
                <p>
                  Best move: <strong>{answer.bestSan}</strong>{#if answer.solutionSan.length > 1}<span class="muted-inline">
                      (also accepted: {answer.solutionSan.slice(1).join(", ")})</span
                    >{/if}
                </p>
              {/if}
              {#if answer.strict}<p class="note">The engine was not available, so only the stored best moves counted.</p>{/if}
              {#if note}<p class="note">{note}</p>{/if}
              {#if answer.bestLineText}
                <button type="button" class="neutral small" aria-expanded={showLine} onclick={() => (showLine = !showLine)}>
                  {showLine ? "Hide engine line" : "Show engine line"}
                </button>
                {#if showLine}<p class="line">{answer.bestLineText}</p>{/if}
              {/if}
            </div>
          {/if}
        </div>
        {#if checkError}<div class="error-card" role="alert"><p>Could not check that move: {checkError}. Try again.</p></div>{/if}

        <div class="actions">
          {#if answer}
            <button type="button" class="primary grow" bind:this={nextButton} onclick={() => moveOn()}>Next puzzle</button>
          {:else}
            <button type="button" class="neutral" disabled={stage === "checking"} onclick={() => moveOn(true)}>Skip</button>
            <button type="button" class="neutral" disabled={stage === "checking"} onclick={() => submit({ giveUp: true })}>
              Give up / show solution
            </button>
          {/if}
          <a class="neutral" href={`#/games/${encodeURIComponent(current.gameId)}/${current.ply}`}>View in game</a>
        </div>
      </section>
    {:else if loading}
      <p class="muted spinning"><Icon name="sync" size={16} />Loading puzzles…</p>
    {:else if loadError}
      <div class="error-card" role="alert">
        <h2>Could not load puzzles</h2>
        <p>{loadError}</p>
        <button type="button" class="neutral" onclick={fetchList}>Try again</button>
      </div>
    {:else if view}
      <!-- Spec section 7, first match wins. -->
      <div class="card message">
        {#if view.phaseFacets.every((f) => f.count === 0) && view.analysedGames === 0}
          <h2>No analysed games yet</h2>
          <p>Puzzles are made from your own Mistakes, Blunders and Misses. Import some games and analyse them first.</p>
          <a class="primary" href="#/games">Go to the library</a>
        {:else if view.phaseFacets.every((f) => f.count === 0)}
          <h2>No puzzles yet</h2>
          <p>
            Puzzles are made from your own Mistakes, Blunders and Misses in analysed games. If your games were analysed before
            puzzles existed, build them now.
          </p>
          {#if queueVisible(queue.status)}<p class="muted">Analysis is still running: puzzles appear here as games finish.</p>{/if}
          <button type="button" class="primary" class:spinning={refreshing} disabled={refreshing} onclick={refresh}>
            {refreshing ? "Refreshing…" : "Refresh puzzles"}
          </button>
        {:else if filterCount > 0 && view.counts.total === 0}
          <h2>No puzzles match these filters</h2>
          <button type="button" class="neutral" onclick={() => show({ mode })}>Clear filters</button>
        {:else if mode === "due"}
          <h2>{seen.size > 0 ? "Session complete" : "Nothing due right now"}</h2>
          <p>
            {#if seen.size > 0}You worked through {plural(seen.size, "puzzle")}.{skipped > 0 ? ` ${skipped} skipped and still due.` : ""}{/if}
            {view.nextDue !== undefined
              ? `Next puzzle due ${relativeTime(view.nextDue, view.now)}.`
              : "Every puzzle is solved or retired. New ones appear as you analyse more games."}
          </p>
          <div class="actions">
            <button type="button" class="primary" onclick={() => setMode("all")}>Practise all puzzles</button>
            {#if skipped > 0}<button type="button" class="neutral" onclick={startRun}>Start again</button>{/if}
          </div>
        {:else}
          <h2>You have been through every puzzle in this view</h2>
          <button type="button" class="primary" onclick={startRun}>Start again</button>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .puzzles {
    max-width: 1024px;
    margin: 0 auto;
  }
  @media (min-width: 768px) {
    .puzzles {
      display: grid;
      grid-template-columns: min(70vh, 560px) minmax(0, 1fr);
      gap: 24px;
      padding: 0 16px;
    }
  }
  .side {
    padding: 12px 16px 0;
  }
  @media (min-width: 768px) {
    .side {
      grid-column: 2;
      grid-row: 1;
      padding: 16px 0 0;
    }
    .board {
      grid-column: 1;
      grid-row: 1;
    }
    .no-board {
      grid-template-columns: minmax(0, 560px);
      justify-content: center;
    }
    .no-board .side {
      grid-column: 1;
    }
  }
  @media (max-width: 767px) {
    .puzzles {
      display: flex;
      flex-direction: column;
    }
    .side {
      display: contents;
    }
    .strip,
    .stats {
      order: -2;
      padding: 0 16px;
    }
    .strip {
      padding-top: 12px;
    }
    .board {
      order: -1;
      margin-top: 8px;
    }
    .panel,
    .side > .card,
    .side > .error-card,
    .side > .muted {
      margin: 12px 16px 0;
    }
  }
  .strip {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .strip .segmented {
    min-width: 152px;
  }
  .strip .filters {
    margin: 0 0 0 auto;
    white-space: nowrap;
  }
  .message h2 {
    margin-top: 0;
  }
  .filter-card,
  .message {
    display: grid;
    gap: 8px;
    margin-top: 12px;
  }
  .filter-card .label {
    color: var(--muted);
    font-size: 14px;
  }
  .message > .primary,
  .message > .neutral {
    justify-self: start;
    margin-top: 4px;
  }
  .stats strong {
    color: var(--ink);
  }
  h2 {
    margin-top: 16px;
    font-size: 18px;
    font-weight: 600;
    outline: none;
  }
  .checking,
  .side > .muted.spinning {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 12px;
  }
  .verdict {
    display: grid;
    gap: 8px;
    margin-top: 12px;
    font-size: 14px;
  }
  .verdict.ok {
    border-color: var(--ok);
  }
  .verdict.danger {
    border-color: var(--danger);
  }
  .verdict-line {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 16px;
  }
  .verdict.ok .verdict-line {
    color: var(--ok);
  }
  .verdict.danger .verdict-line {
    color: var(--danger);
  }
  .note {
    color: var(--muted);
  }
  .verdict .small {
    justify-self: start;
    margin-top: 0;
  }
  .line {
    font-family: ui-monospace, monospace;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 12px;
  }
  .actions > * {
    flex: 1;
    justify-content: center;
    text-align: center;
    margin-top: 0;
  }
  .actions .grow {
    flex: 2;
  }
</style>
