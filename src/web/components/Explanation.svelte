<script lang="ts">
  /** docs/06-GAMES-SPEC.md section B7 "Explanation (under the board, info area)". */
  import ClassBadge from "./ClassBadge.svelte";
  import { buildMoveExplanation, annotatedSan, CLASS_INFO } from "../../server/analysis/texts.ts";
  import { scoreTextFromLine } from "../lib/scoreText.ts";
  import type { GameReviewRow } from "../../server/games/reviewRow.ts";

  let {
    game,
    currentPly,
    plyCount,
  }: {
    game: GameReviewRow;
    currentPly: number;
    plyCount: number;
  } = $props();

  function moverWinPercent(whiteWinPercent: number, mover: "w" | "b"): number {
    return mover === "w" ? whiteWinPercent : 100 - whiteWinPercent;
  }

  const noMoves = $derived(plyCount === 0);
  const mover = $derived<"w" | "b">(currentPly % 2 === 1 ? "w" : "b");
  const move = $derived(currentPly >= 1 ? game.analysis?.moves[currentPly - 1] : undefined);
  // The move about to be played: its bestLine is the engine's suggestion for the position now on the board.
  const nextMove = $derived(game.analysis?.moves[currentPly]);

  const moveLabel = $derived(`${Math.ceil(currentPly / 2)}${mover === "w" ? "." : "..."}`);
  const moveText = $derived.by(() => {
    const san = game.positions.sans[currentPly];
    if (!san) return "";
    return move ? annotatedSan(san, move.classification) : san;
  });

  const body = $derived.by(() => {
    if (currentPly === 0) {
      return game.analysis ? "Step forward to see each move explained." : "Step forward to replay the game. Analyse it to see how each move was played.";
    }
    if (!move) return "Not analysed yet.";
    return buildMoveExplanation({
      cls: move.classification,
      tag: move.tag,
      moverWinPercentBefore: moverWinPercent(move.winPercentBefore, move.colour),
      moverWinPercentAfter: moverWinPercent(move.winPercentAfter, move.colour),
      mover: move.colour,
      myColour: game.myColour,
      bestSan: move.bestSan,
    });
  });

  // docs/06-GAMES-SPEC.md section B7: not shown at the last ply.
  const engineLineText = $derived.by(() => {
    if (currentPly >= plyCount || !nextMove?.bestLine || !nextMove.engineLineText) return undefined;
    const score = scoreTextFromLine(nextMove.bestLine);
    return `Engine line${score !== "–" ? ` (${score})` : ""}: ${nextMove.engineLineText}`;
  });
</script>

<div class="card" aria-live="polite">
  {#if noMoves}
    <h2>No moves</h2>
    <p>This game has no moves to review.</p>
  {:else if currentPly === 0}
    <h2>Start position</h2>
    <p>{body}</p>
  {:else}
    <div class="head">
      {#if move}
        <ClassBadge cls={move.classification} size={22} />
      {/if}
      <span class="move-text">{moveLabel} {moveText}</span>
      {#if move}
        <span class="class-label">{CLASS_INFO[move.classification].label}</span>
      {/if}
    </div>
    <p>{body}</p>
    {#if engineLineText}
      <p class="engine-line">{engineLineText}</p>
    {/if}
  {/if}
</div>

<style>
  h2 {
    font-size: 15px;
    margin: 0 0 4px;
  }
  p {
    font-size: 14px;
    margin: 0;
  }
  .head {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
  }
  .move-text {
    font-size: 15px;
    font-weight: 600;
  }
  .class-label {
    font-size: 13px;
    color: var(--muted);
  }
  .engine-line {
    margin-top: 8px;
    font-size: 12px;
    color: var(--muted);
  }
</style>
