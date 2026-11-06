<script lang="ts">
  /** docs/06-GAMES-SPEC.md section B9: the phone bottom sheet wrapping the graph and the review tabs. */
  import Transport from "./Transport.svelte";
  import EvalGraph from "./EvalGraph.svelte";
  import GameReviewPanel from "./GameReviewPanel.svelte";
  import Icon from "./Icon.svelte";
  import type { MoveRecord, KeyMoment } from "../../server/analysis/game.ts";
  import type { GameReviewRow } from "../../server/games/reviewRow.ts";
  import type { MoveClass } from "../../server/analysis/classification.ts";

  let {
    game,
    sans,
    analysisMoves,
    keyMoments,
    winPercents,
    classifications,
    currentPly,
    plyCount,
    playing,
    exploring = false,
    onJump,
    onFirst,
    onPrevious,
    onTogglePlay,
    onNext,
    onLast,
  }: {
    game: GameReviewRow;
    sans: (string | undefined)[];
    analysisMoves: MoveRecord[] | undefined;
    keyMoments: KeyMoment[] | undefined;
    winPercents: (number | undefined)[];
    classifications: (MoveClass | undefined)[];
    currentPly: number;
    plyCount: number;
    playing: boolean;
    /** docs/06-GAMES-SPEC.md section B10: transport is disabled while exploring. */
    exploring?: boolean;
    onJump: (ply: number) => void;
    onFirst: () => void;
    onPrevious: () => void;
    onTogglePlay: () => void;
    onNext: () => void;
    onLast: () => void;
  } = $props();

  let open = $state(false);
  let opener: HTMLElement | undefined;
  let grabberEl: HTMLButtonElement | undefined = $state();
  let closeButtonEl: HTMLButtonElement | undefined = $state();

  function openSheet(from: HTMLElement | undefined): void {
    if (open) return;
    opener = from;
    open = true;
  }

  function closeSheet(): void {
    if (!open) return;
    open = false;
    // The expand button only exists while collapsed, so it's gone by the time we close; fall back to the grabber.
    const focusTarget = opener && document.contains(opener) ? opener : grabberEl;
    focusTarget?.focus();
    opener = undefined;
  }

  // docs/06-GAMES-SPEC.md section B9: opening moves focus to the close button.
  $effect(() => {
    if (open) closeButtonEl?.focus();
  });

  // Picking a move or a key moment closes the sheet; tapping the graph does not.
  function jumpAndClose(ply: number): void {
    onJump(ply);
    closeSheet();
  }

  function onKeydown(e: KeyboardEvent): void {
    if (e.key === "Escape" && open) {
      e.preventDefault();
      closeSheet();
    }
  }

  // docs/06-GAMES-SPEC.md section B9: tapping the grabber, or dragging it past the 36px threshold in the
  // sensible direction, always just toggles open/closed - a shorter drag "counts as a tap" either way, so
  // every grabber gesture resolves to the same toggle on release. Pointer capture (not a plain click handler)
  // is what's needed here: a real drag suppresses the browser's own "click" event, but not "pointerup".
  function onGrabberPointerDown(e: PointerEvent): void {
    grabberEl?.setPointerCapture(e.pointerId);
  }
  function onGrabberPointerUp(): void {
    if (open) closeSheet();
    else openSheet(grabberEl);
  }
</script>

<svelte:window onkeydown={onKeydown} />

<div class="sheet" class:open role="group" aria-label="Moves panel">
  <button
    bind:this={grabberEl}
    type="button"
    class="grabber"
    aria-label={open ? "Collapse the moves panel" : "Expand the moves panel"}
    onpointerdown={onGrabberPointerDown}
    onpointerup={onGrabberPointerUp}
  ></button>

  {#if open}
    <div class="expanded-header">
      <Transport
        {currentPly}
        {plyCount}
        {playing}
        disabled={plyCount === 0 || exploring}
        {onFirst}
        {onPrevious}
        {onTogglePlay}
        {onNext}
        {onLast}
      />
      <button bind:this={closeButtonEl} type="button" class="close" aria-label="Collapse the moves panel" onclick={closeSheet}>
        <Icon name="close" size={18} />
      </button>
    </div>
  {/if}

  <EvalGraph {winPercents} {classifications} {currentPly} {onJump} height={open ? 96 : 40} />

  <GameReviewPanel
    {game}
    {sans}
    {analysisMoves}
    {keyMoments}
    {currentPly}
    onJump={jumpAndClose}
    hideContent={!open}
    onTabActivate={(source) => openSheet(source)}
    onExpand={open ? undefined : (source) => openSheet(source)}
  />
</div>

<style>
  .sheet {
    position: sticky;
    bottom: 0;
    margin-top: 8px;
    border: 1px solid var(--line);
    border-radius: 16px 16px 0 0;
    background: var(--surface);
    padding-bottom: env(safe-area-inset-bottom);
  }
  .sheet.open {
    position: fixed;
    inset: 0;
    margin-top: 0;
    border-radius: 0;
    overflow-y: auto;
    z-index: 20;
  }
  .grabber {
    display: block;
    width: 36px;
    height: 20px;
    margin: 0 auto;
    padding: 0;
    border: none;
    background: none;
    cursor: pointer;
    position: relative;
  }
  .grabber::before {
    content: "";
    position: absolute;
    top: 8px;
    left: 50%;
    width: 36px;
    height: 4px;
    border-radius: 2px;
    background: var(--line);
    transform: translateX(-50%);
  }
  .expanded-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 8px;
  }
  .expanded-header :global(.transport) {
    flex: 1;
  }
  .close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    flex: none;
    border: 1px solid var(--line);
    border-radius: 12px;
    background: var(--surface);
    color: var(--ink);
    cursor: pointer;
  }
</style>
