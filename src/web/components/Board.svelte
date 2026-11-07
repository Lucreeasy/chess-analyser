<script lang="ts">
  import "@lichess-org/chessground/assets/chessground.base.css";
  import "@lichess-org/chessground/assets/chessground.cburnett.css";
  import { Chessground } from "@lichess-org/chessground";
  import { untrack } from "svelte";
  import type { Api } from "@lichess-org/chessground/api";
  import type { Key, Color } from "@lichess-org/chessground/types";
  import type { DrawShape } from "@lichess-org/chessground/draw";
  import type { MoveClass } from "../../server/analysis/classification.ts";
  import { pieceNames } from "../lib/pieceNames.ts";
  import ClassBadge from "./ClassBadge.svelte";
  import PromotionDialog from "./PromotionDialog.svelte";

  /**
   * docs/07-UI-SPEC.md section 6.1: the three board palettes (light square, dark square; then both slightly dimmed
   * for dark mode). The active one is a single configuration value; there is no chooser yet.
   */
  const BOARD_THEMES = {
    ink: ["#e9e4d4", "#5b8a86", "#d9d4c4", "#4f7b77"],
    paper: ["#f3ecd9", "#b99c74", "#e3dcc7", "#a58a64"],
    slate: ["#d7dde4", "#6b7f95", "#c7cdd5", "#5f7287"],
  } as const;
  const BOARD_THEME: keyof typeof BOARD_THEMES = "ink";
  const [light, dark, lightDim, darkDim] = BOARD_THEMES[BOARD_THEME];

  const PROMOTION_ROLE = { q: "queen", r: "rook", b: "bishop", n: "knight" } as const;

  /** docs/06-GAMES-SPEC.md section B3: amber played arrow, green best-move arrow (the rest are chessground's own defaults, unused here but required by its Config type). */
  const BRUSHES = {
    green: { key: "green", color: "#3fa35a", opacity: 0.9, lineWidth: 10 },
    red: { key: "red", color: "#882020", opacity: 1, lineWidth: 10 },
    blue: { key: "blue", color: "#003088", opacity: 1, lineWidth: 10 },
    yellow: { key: "yellow", color: "#e68f00", opacity: 1, lineWidth: 10 },
    amber: { key: "amber", color: "#c9731c", opacity: 0.9, lineWidth: 10 },
  };

  let {
    fen,
    orientation,
    lastMove,
    arrows = [],
    badge,
    label,
    movable,
  }: {
    fen: string;
    orientation: Color;
    /** "e2e4" (Move.lan), the project-wide convention for a move's squares. */
    lastMove?: string;
    arrows?: { orig: string; dest: string; brush: "amber" | "green" }[];
    /** The classification badge at the destination square of the current move. */
    badge?: { square: string; cls: MoveClass };
    /** docs/06-GAMES-SPEC.md section B3: the board's accessible name. */
    label: string;
    /** When set, the board is interactive for this side (docs/06-GAMES-SPEC.md section B10 Explore mode). */
    movable?: {
      colour: Color;
      /** Legal destinations per origin square, from GET /api/explore/dests. */
      dests: Record<string, string[]>;
      /** Called with a finished move's UCI, e.g. "e2e4" or "e7e8q" once any promotion is chosen. */
      onMove: (uci: string) => void;
    };
  } = $props();

  let el: HTMLDivElement;
  let api: Api | undefined;
  let promotion: { orig: Key; dest: Key } | undefined = $state();

  function cgLastMove(move: string | undefined): [Key, Key] | undefined {
    return move ? [move.slice(0, 2) as Key, move.slice(2, 4) as Key] : undefined;
  }

  function cgShapes(shapes: { orig: string; dest: string; brush: string }[]): DrawShape[] {
    return shapes.map((s) => ({ orig: s.orig as Key, dest: s.dest as Key, brush: s.brush }));
  }

  function cgDests(dests: Record<string, string[]> | undefined): Map<Key, Key[]> {
    const map = new Map<Key, Key[]>();
    for (const [from, tos] of Object.entries(dests ?? {})) map.set(from as Key, tos as Key[]);
    return map;
  }

  /** A pawn landing on the last rank needs the promotion picker before the move can be finalised. */
  function handleAfter(orig: Key, dest: Key): void {
    const piece = api?.state.pieces.get(dest);
    if (piece?.role === "pawn" && (dest[1] === "8" || dest[1] === "1")) {
      promotion = { orig, dest };
    } else {
      movable?.onMove(`${orig}${dest}`);
    }
  }

  function choosePromotion(letter: "q" | "r" | "b" | "n"): void {
    if (!promotion) return;
    const { orig, dest } = promotion;
    const colour = api?.state.pieces.get(dest)?.color;
    if (colour) api?.setPieces(new Map([[dest, { role: PROMOTION_ROLE[letter], color: colour }]]));
    promotion = undefined;
    movable?.onMove(`${orig}${dest}${letter}`);
  }

  function cancelPromotion(): void {
    promotion = undefined;
    api?.set({ fen }); // revert the optimistic move chessground already drew
  }

  $effect(() => {
    api = Chessground(
      el,
      untrack(() => ({
        fen,
        orientation,
        turnColor: movable?.colour ?? "white",
        lastMove: cgLastMove(lastMove),
        // Always false: chessground only binds its pointer listeners once, at construction
        // (events.js's bindBoard checks viewOnly then and never re-binds on a later .set()), so
        // toggling it reactively for Explore mode would leave an interactive board that never
        // actually responds to clicks or drags. Interactivity is instead gated by movable.color/
        // dests below, which board.js does read fresh on every pointer event.
        viewOnly: false,
        coordinates: true,
        ranksPosition: "left",
        highlight: { lastMove: true },
        animation: { enabled: true },
        drawable: { enabled: false, autoShapes: cgShapes(arrows), brushes: BRUSHES },
        movable: { free: false, color: movable?.colour, dests: cgDests(movable?.dests), showDests: true, events: { after: handleAfter } },
        draggable: { enabled: !!movable },
        selectable: { enabled: !!movable },
      })),
    );
    return () => api?.destroy();
  });

  $effect(() => {
    api?.set({
      fen,
      orientation,
      turnColor: movable?.colour ?? "white",
      lastMove: cgLastMove(lastMove),
      drawable: { autoShapes: cgShapes(arrows) },
      movable: { color: movable?.colour, dests: cgDests(movable?.dests) },
      draggable: { enabled: !!movable },
      selectable: { enabled: !!movable },
    });
  });

  /** The destination square's position as a percentage of the board, from the top-left, for the badge overlay. */
  function squareOffset(square: string, boardOrientation: Color): { left: number; top: number } {
    const file = square.charCodeAt(0) - 97;
    const rank = Number(square[1]) - 1;
    const col = boardOrientation === "white" ? file : 7 - file;
    const row = boardOrientation === "white" ? 7 - rank : rank;
    return { left: (col / 8) * 100, top: (row / 8) * 100 };
  }

  const badgeOffset = $derived(badge ? squareOffset(badge.square, orientation) : undefined);
</script>

<div
  class="board-wrap"
  role="group"
  aria-label={label}
  style={`--sq-light: ${light}; --sq-dark: ${dark}; --sq-light-dim: ${lightDim}; --sq-dark-dim: ${darkDim};`}
>
  <div class="board" bind:this={el} aria-hidden="true"></div>
  <!-- docs/06-GAMES-SPEC.md section B3: each piece has a text name; chessground's own piece elements are unlabelled. -->
  <div class="sr-only">
    {#each pieceNames(fen) as name (name)}<span role="img" aria-label={name}></span>{/each}
  </div>
  {#if badge && badgeOffset}
    <div class="badge" style={`left: ${badgeOffset.left}%; top: ${badgeOffset.top}%;`}>
      <ClassBadge cls={badge.cls} labelled />
    </div>
  {/if}
</div>
{#if promotion}
  <PromotionDialog colour={movable?.colour ?? "white"} onChoose={choosePromotion} onCancel={cancelPromotion} />
{/if}

<style>
  .board-wrap {
    position: relative;
  }
  .board {
    width: 100%;
    aspect-ratio: 1;
  }
  /* docs/07-UI-SPEC.md sections 3.1 and 6.1: the squares (a8 light), and the highlight colours. */
  .board-wrap {
    --last-move: rgba(246, 214, 72, 0.5);
  }
  @media (prefers-color-scheme: dark) {
    .board-wrap {
      --sq-light: var(--sq-light-dim);
      --sq-dark: var(--sq-dark-dim);
      --last-move: rgba(246, 214, 72, 0.38);
    }
  }
  .board-wrap :global(cg-board) {
    background: repeating-conic-gradient(var(--sq-dark) 0 25%, var(--sq-light) 0 50%) 0 0 / 25% 25%;
  }
  /* docs/07-UI-SPEC.md section 6.2: coordinates inside the edge squares, 600 weight, 2.4 % of the board width
     clamped to 8-12 px, in the opposite square colour (chessground tags each label with the colour under it). */
  .board-wrap {
    container-type: inline-size;
  }
  .board-wrap :global(.cg-wrap coords) {
    font-family: inherit;
    font-size: clamp(8px, 2.4cqw, 12px);
    font-weight: 600;
    line-height: 1;
    opacity: 1;
    left: 0;
  }
  .board-wrap :global(.cg-wrap coords.ranks) {
    top: 0;
    width: 12.5%;
    align-items: flex-start;
  }
  .board-wrap :global(.cg-wrap coords.files) {
    bottom: 0;
    height: 12.5%;
    text-transform: none;
  }
  .board-wrap :global(.cg-wrap coords coord) {
    flex: 1 1 0;
    display: flex;
    padding: 3px 4px;
    transform: none;
  }
  .board-wrap :global(.cg-wrap coords.files coord) {
    align-items: flex-end;
    justify-content: flex-end;
  }
  .board-wrap :global(coord.coord-light) {
    color: var(--sq-dark);
  }
  .board-wrap :global(coord.coord-dark) {
    color: var(--sq-light);
  }
  .board-wrap :global(cg-board square.last-move) {
    background-color: var(--last-move);
  }
  .board-wrap :global(cg-board square.selected) {
    background-color: rgba(60, 140, 255, 0.45);
  }
  .board-wrap :global(cg-board square.move-dest) {
    background: radial-gradient(circle closest-side, rgba(20, 30, 40, 0.35) 36%, transparent 37%);
  }
  .board-wrap :global(cg-board square.oc.move-dest) {
    background: radial-gradient(transparent 80%, rgba(20, 30, 40, 0.35) 80%);
  }
  .badge {
    position: absolute;
    width: 12.5%;
    height: 12.5%;
    display: flex;
    align-items: flex-start;
    justify-content: flex-end;
    pointer-events: none;
    z-index: 3; /* above chessground's pieces (z-index 2) */
  }
  /* docs/07-UI-SPEC.md section 6.2: 46 % of the square wide, 2 % inset, a tiny drop shadow. */
  .badge :global(svg) {
    margin: 2% 2% 0 0; /* percentages of the square-sized .badge box */
    width: 46%;
    height: auto;
    filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.35));
  }
</style>
