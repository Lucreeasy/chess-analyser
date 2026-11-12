<script lang="ts">
  import MovesList from "./MovesList.svelte";
  import KeyMomentsList from "./KeyMomentsList.svelte";
  import SummaryTab from "./SummaryTab.svelte";
  import Icon from "./Icon.svelte";
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
    hideContent = false,
    onTabActivate,
    onExpand,
  }: {
    game: GameReviewRow;
    sans: (string | undefined)[];
    analysisMoves: MoveRecord[] | undefined;
    keyMoments: KeyMoment[] | undefined;
    currentPly: number;
    onJump: (ply: number) => void;
    /** The phone bottom sheet's collapsed peek doesn't create the tab content. */
    hideContent?: boolean;
    /** Called whenever a tab button is activated (click or arrow-key), with the element that triggered it. */
    onTabActivate?: (source: HTMLElement) => void;
    /** When set, an "Expand the moves panel" button is shown at the end of the tab row (the collapsed phone sheet). */
    onExpand?: (source: HTMLElement) => void;
  } = $props();

  // "The chosen tab is remembered while the screen is open" - plain state, not the address.
  let active: TabId = $state("moves");

  function activate(id: TabId, source: HTMLElement): void {
    active = id;
    onTabActivate?.(source);
  }

  function onKeydown(e: KeyboardEvent): void {
    const id = tabArrowKey(e, TAB_IDS, active);
    if (!id) return;
    const el = document.getElementById(`review-tab-${id}`);
    if (!el) return;
    activate(id, el);
    el.focus();
  }
</script>

<section class="panel" aria-label="Game review panel">
  <div class="tab-row">
  <div role="tablist" aria-label="Game views" class="tabs" tabindex="-1" onkeydown={onKeydown}>
    {#each TABS as tab (tab.id)}
      <button
        id={`review-tab-${tab.id}`}
        type="button"
        role="tab"
        aria-selected={active === tab.id}
        aria-controls={active === tab.id && !hideContent ? `review-panel-${tab.id}` : undefined}
        tabindex={active === tab.id ? 0 : -1}
        class="tab"
        class:active={active === tab.id}
        onclick={(e) => activate(tab.id, e.currentTarget)}
      >{tab.label}</button>
    {/each}
  </div>
  {#if onExpand}
    <button type="button" class="expand" aria-label="Expand the moves panel" onclick={(e) => onExpand(e.currentTarget)}>
      <Icon name="chevronUp" size={22} />
    </button>
  {/if}
  </div>

  {#if !hideContent}
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
  {/if}
</section>

<style>
  .panel {
    margin-top: 16px;
  }
  .tab-row {
    display: flex;
    border-bottom: 1px solid var(--line);
  }
  .tabs {
    flex: 1;
    display: flex;
    gap: 4px;
  }
  /* 13 px on the phone sheet, 14 px on the desktop panel; selected: Surface-2, Brand text, 3 px Brand bar. */
  .tab {
    flex: 1 1 auto;
    min-height: 44px;
    padding: 0 8px;
    border: none;
    border-bottom: 3px solid transparent;
    border-radius: 12px 12px 0 0;
    background: none;
    color: var(--muted);
    font-size: 13px;
    font-weight: 500;
    white-space: nowrap;
    cursor: pointer;
  }
  @media (min-width: 768px) {
    .tab {
      font-size: 14px;
    }
  }
  .tab.active {
    background: var(--surface-2);
    color: var(--brand);
    font-weight: 600;
    border-bottom-color: var(--brand);
  }
  .expand {
    flex: none;
    margin-left: auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border: none;
    background: none;
    color: var(--muted);
    cursor: pointer;
  }
  .muted {
    color: var(--muted);
    font-size: 14px;
    padding: 12px 4px;
  }
</style>
