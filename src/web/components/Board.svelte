<script lang="ts">
  import "@lichess-org/chessground/assets/chessground.base.css";
  import "@lichess-org/chessground/assets/chessground.brown.css";
  import "@lichess-org/chessground/assets/chessground.cburnett.css";
  import { Chessground } from "@lichess-org/chessground";
  import { untrack } from "svelte";
  import type { Api } from "@lichess-org/chessground/api";
  import type { Key, Color } from "@lichess-org/chessground/types";
  import type { DrawShape } from "@lichess-org/chessground/draw";
  import type { MoveClass } from "../../server/analysis/classification.ts";
  import ClassBadge from "./ClassBadge.svelte";

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
  } = $props();

  let el: HTMLDivElement;
  let api: Api | undefined;

  function cgLastMove(move: string | undefined): [Key, Key] | undefined {
    return move ? [move.slice(0, 2) as Key, move.slice(2, 4) as Key] : undefined;
  }

  function cgShapes(shapes: { orig: string; dest: string; brush: string }[]): DrawShape[] {
    return shapes.map((s) => ({ orig: s.orig as Key, dest: s.dest as Key, brush: s.brush }));
  }

  $effect(() => {
    api = Chessground(
      el,
      untrack(() => ({
        fen,
        orientation,
        lastMove: cgLastMove(lastMove),
        viewOnly: true,
        coordinates: false,
        highlight: { lastMove: true },
        animation: { enabled: true },
        drawable: { enabled: false, autoShapes: cgShapes(arrows), brushes: BRUSHES },
      })),
    );
    return () => api?.destroy();
  });

  $effect(() => {
    api?.set({ fen, orientation, lastMove: cgLastMove(lastMove), drawable: { autoShapes: cgShapes(arrows) } });
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

<div class="board-wrap" role="group" aria-label={label}>
  <div class="board" bind:this={el}></div>
  {#if badge && badgeOffset}
    <div class="badge" style={`left: ${badgeOffset.left}%; top: ${badgeOffset.top}%;`}>
      <ClassBadge cls={badge.cls} size={22} labelled />
    </div>
  {/if}
</div>

<style>
  .board-wrap {
    position: relative;
  }
  .board {
    width: 100%;
    aspect-ratio: 1;
  }
  .badge {
    position: absolute;
    width: 12.5%;
    height: 12.5%;
    display: flex;
    align-items: flex-start;
    justify-content: flex-end;
    padding: 2px;
    pointer-events: none;
  }
</style>
