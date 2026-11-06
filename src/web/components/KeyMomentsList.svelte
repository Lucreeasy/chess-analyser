<script lang="ts">
  import ClassBadge from "./ClassBadge.svelte";
  import type { KeyMoment, MoveRecord } from "../../server/analysis/game.ts";

  let {
    keyMoments,
    analysisMoves,
    currentPly,
    onJump,
  }: {
    keyMoments: KeyMoment[];
    analysisMoves: MoveRecord[];
    currentPly: number;
    onJump: (ply: number) => void;
  } = $props();
</script>

<div class="panel" role="group" aria-label="Key moments">
  {#if keyMoments.length === 0}
    <p class="empty">No big swings in this game.</p>
  {:else}
    <ul class="list">
      {#each keyMoments as moment (moment.ply)}
        {@const move = analysisMoves[moment.ply - 1]}
        <li>
          <button type="button" class="entry" class:current={moment.ply === currentPly} onclick={() => onJump(moment.ply)}>
            <ClassBadge cls={move.classification} size={22} labelled />
            <span class="body">
              <span class="header"
                >Move {Math.ceil(moment.ply / 2)} · {move.colour === "w" ? "White" : "Black"} · −{Math.round(moment.swing)}%</span
              >
              <span class="sentence">{moment.sentence}</span>
            </span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .panel {
    min-height: 0;
  }
  .empty {
    color: var(--muted);
    font-size: 14px;
    padding: 12px 4px;
  }
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .entry {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    width: 100%;
    min-height: 44px;
    padding: 10px;
    border: 1px solid var(--line);
    border-radius: 12px;
    background: var(--surface);
    color: var(--ink);
    text-align: left;
    cursor: pointer;
  }
  .entry:hover {
    background: var(--surface-2);
  }
  .entry.current {
    border-color: var(--brand);
    background: var(--surface-2);
  }
  .body {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .header {
    font-size: 13px;
    font-weight: 600;
    color: var(--muted);
  }
  .sentence {
    font-size: 14px;
  }
</style>
