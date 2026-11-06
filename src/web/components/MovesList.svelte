<script lang="ts">
  import ClassBadge from "./ClassBadge.svelte";
  import { annotatedSan, CLASS_INFO } from "../../server/analysis/texts.ts";
  import type { MoveRecord } from "../../server/analysis/game.ts";

  let {
    sans,
    analysisMoves,
    currentPly,
    onJump,
  }: {
    /** Length plyCount + 1; index 0 unused (the start position has no move). */
    sans: (string | undefined)[];
    analysisMoves: MoveRecord[] | undefined;
    currentPly: number;
    onJump: (ply: number) => void;
  } = $props();

  const plyCount = $derived(sans.length - 1);

  interface Row {
    number: number;
    white: number;
    black?: number;
  }

  const rows = $derived.by(() => {
    const out: Row[] = [];
    for (let ply = 1; ply <= plyCount; ply += 2) {
      out.push({ number: Math.ceil(ply / 2), white: ply, black: ply + 1 <= plyCount ? ply + 1 : undefined });
    }
    return out;
  });

  function moveText(ply: number): string {
    const san = sans[ply];
    if (!san) return "";
    const move = analysisMoves?.[ply - 1];
    return move ? annotatedSan(san, move.classification) : san;
  }

  // docs/06-GAMES-SPEC.md section B7: "{n}. {move}, {Label}" ("9... Nb8, Blunder").
  function accessibleName(ply: number, number: number, colour: "w" | "b"): string {
    const prefix = colour === "w" ? `${number}.` : `${number}...`;
    const move = analysisMoves?.[ply - 1];
    const text = `${prefix} ${sans[ply]}`;
    return move ? `${text}, ${CLASS_INFO[move.classification].label}` : text;
  }

  let listEl: HTMLDivElement | undefined = $state();
  $effect(() => {
    currentPly;
    listEl?.querySelector(".cell.current")?.scrollIntoView({ block: "nearest" });
  });
</script>

<div class="panel" role="group" aria-label="Moves">
  {#if plyCount === 0}
    <p class="empty">This game has no moves.</p>
  {:else}
    <div class="header-row">
      <span class="num-col"></span>
      <span class="col-title">White</span>
      <span class="col-title">Black</span>
    </div>
    <div class="list" bind:this={listEl}>
      {#each rows as row (row.number)}
        <div class="row">
          <span class="num">{row.number}.</span>
          <button
            type="button"
            class="cell"
            class:current={row.white === currentPly}
            onclick={() => onJump(row.white)}
            aria-current={row.white === currentPly ? "step" : undefined}
            aria-label={accessibleName(row.white, row.number, "w")}
          >
            {#if analysisMoves?.[row.white - 1]}<ClassBadge cls={analysisMoves[row.white - 1]!.classification} size={18} />{/if}
            {moveText(row.white)}
          </button>
          {#if row.black}
            <button
              type="button"
              class="cell"
              class:current={row.black === currentPly}
              onclick={() => onJump(row.black!)}
              aria-current={row.black === currentPly ? "step" : undefined}
              aria-label={accessibleName(row.black, row.number, "b")}
            >
              {#if analysisMoves?.[row.black - 1]}<ClassBadge cls={analysisMoves[row.black - 1]!.classification} size={18} />{/if}
              {moveText(row.black)}
            </button>
          {:else}
            <span class="cell empty-cell"></span>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .panel {
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  .empty {
    color: var(--muted);
    font-size: 14px;
    padding: 12px;
  }
  .header-row {
    display: grid;
    grid-template-columns: 36px 1fr 1fr;
    gap: 4px;
    padding: 4px 4px 2px;
  }
  .col-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--muted);
  }
  .list {
    overflow-y: auto;
    max-height: 320px;
  }
  .row {
    display: grid;
    grid-template-columns: 36px 1fr 1fr;
    gap: 4px;
    align-items: center;
  }
  .num {
    text-align: right;
    font-size: 14px;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
    padding-right: 4px;
  }
  .cell {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 44px;
    padding: 0 8px;
    border: none;
    border-radius: 8px;
    background: none;
    color: var(--ink);
    font-size: 15px;
    text-align: left;
    cursor: pointer;
  }
  .cell:hover {
    background: var(--surface-2);
  }
  .cell.current {
    background: var(--brand);
    color: var(--brand-ink);
    font-weight: 600;
  }
  .empty-cell {
    min-height: 44px;
  }
</style>
