<script lang="ts">
  import "@lichess-org/chessground/assets/chessground.base.css";
  import "@lichess-org/chessground/assets/chessground.brown.css";
  import "@lichess-org/chessground/assets/chessground.cburnett.css";
  import { Chessground } from "@lichess-org/chessground";
  import { untrack } from "svelte";
  import type { Api } from "@lichess-org/chessground/api";
  import type { Key, Color } from "@lichess-org/chessground/types";

  let {
    fen,
    orientation,
    lastMove,
  }: {
    fen: string;
    orientation: Color;
    /** "e2e4" (Move.lan), the project-wide convention for a move's squares. */
    lastMove?: string;
  } = $props();

  let el: HTMLDivElement;
  let api: Api | undefined;

  function cgLastMove(move: string | undefined): [Key, Key] | undefined {
    return move ? [move.slice(0, 2) as Key, move.slice(2, 4) as Key] : undefined;
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
        drawable: { enabled: false },
      })),
    );
    return () => api?.destroy();
  });

  $effect(() => {
    api?.set({ fen, orientation, lastMove: cgLastMove(lastMove) });
  });
</script>

<div class="board" bind:this={el}></div>

<style>
  .board {
    width: 100%;
    aspect-ratio: 1;
  }
</style>
