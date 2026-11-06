<script lang="ts">
  import MovesList from "./MovesList.svelte";
  import KeyMomentsList from "./KeyMomentsList.svelte";
  import SummaryTab from "./SummaryTab.svelte";
  import { tabArrowKey } from "../lib/tablist.ts";
  import type { MoveRecord, KeyMoment } from "../../server/analysis/game.ts";
  import type { GameReviewRow } from "../../server/games/reviewRow.ts";

  const TABS = [
    { id: "moves", label: "Moves" },
    { id: "summary", label: "Summary" },
    { id: "keyMoments", label: "Key moments" },
  ] as const;
  type TabId = (typeof TABS)[number]["id"];
  const TAB_IDS = TABS.map((t) => t.id);

  let {
    game,
    sans,
    analysisMoves,
    keyMoments,
    currentPly,
    onJump,
  }: {
    game: GameReviewRow;
    sans: (string | undefined)[];
    analysisMoves: MoveRecord[] | undefined;
    keyMoments: KeyMoment[] | undefined;
    currentPly: number;
    onJump: (ply: number) => void;
  } = $props();

  // docs/06-GAMES-SPEC.md section B7: "The chosen tab is remembered while the screen is open" - plain state, not the address.
  let active: TabId = $state("moves");

  function onKeydown(e: KeyboardEvent): void {
    const id = tabArrowKey(e, TAB_IDS, active);
    if (!id) return;
    active = id;
    document.getElementById(`review-tab-${id}`)?.focus();
  }
</script>

<section class="panel" aria-label="Game review panel">
  <div role="tablist" aria-label="Game views" class="tabs" tabindex="-1" onkeydown={onKeydown}>
    {#each TABS as tab (tab.id)}
      <button
        id={`review-tab-${tab.id}`}
        type="button"
        role="tab"
        aria-selected={active === tab.id}
        aria-controls={`review-panel-${tab.id}`}
        tabindex={active === tab.id ? 0 : -1}
        class="tab"
        class:active={active === tab.id}
        onclick={() => (active = tab.id)}
      >{tab.label}</button>
    {/each}
  </div>

  {#if active === "moves"}
    <div id="review-panel-moves" role="tabpanel" aria-labelledby="review-tab-moves">
      <MovesList {sans} {analysisMoves} {currentPly} {onJump} />
    </div>
  {:else if active === "summary"}
    <div id="review-panel-summary" role="tabpanel" aria-labelledby="review-tab-summary">
      <SummaryTab {game} />
    </div>
  {:else if analysisMoves && keyMoments}
    <div id="review-panel-keyMoments" role="tabpanel" aria-labelledby="review-tab-keyMoments">
      <KeyMomentsList {keyMoments} {analysisMoves} {currentPly} {onJump} />
    </div>
  {:else}
    <div id="review-panel-keyMoments" role="tabpanel" aria-labelledby="review-tab-keyMoments">
      <p class="muted">Key moments appear here once the game is analysed.</p>
    </div>
  {/if}
</section>

<style>
  .panel {
    margin-top: 16px;
  }
  .tabs {
    display: flex;
    border-bottom: 1px solid var(--line);
    gap: 4px;
  }
  .tab {
    min-height: 44px;
    padding: 0 12px;
    border: none;
    background: none;
    color: var(--muted);
    font-size: 14px;
    font-weight: 600;
    border-bottom: 2px solid transparent;
    cursor: pointer;
  }
  .tab.active {
    color: var(--ink);
    border-bottom-color: var(--brand);
  }
  .muted {
    color: var(--muted);
    font-size: 14px;
    padding: 12px 4px;
  }
</style>
