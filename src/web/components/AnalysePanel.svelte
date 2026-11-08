<script lang="ts">
  /** docs/06-GAMES-SPEC.md section B8: shown in place of the review tabs until a game is analysed. */
  import Icon from "./Icon.svelte";
  import { apiGet, apiPost, ApiError } from "../lib/api.ts";
  import { onAnalyseProgress } from "../lib/live.svelte.ts";
  import { SEARCH_DEPTH } from "../../server/analysisQueue/depthPresets.ts";
  import type { DepthPreset } from "../../server/settings.ts";

  let {
    gameId,
    analysisStatus,
    onQueued,
  }: {
    gameId: string;
    analysisStatus: "none" | "queued" | "running" | "error";
    /** Called after a successful queue request, so the caller can re-fetch and pick up the new status. */
    onQueued: () => void;
  } = $props();

  const DEPTH_LABEL: Record<DepthPreset, string> = { quick: "Quick", standard: "Standard", deep: "Deep" };

  let selectedDepth: DepthPreset = $state("standard");
  apiGet<{ depthPreset: DepthPreset }>("settings")
    .then((s) => (selectedDepth = s.depthPreset))
    .catch(() => {});

  let busy = $state(false);
  let requestError: string | undefined = $state(undefined);

  let liveProgress: { ply: number; total: number } | undefined = $state();
  let announcement = $state("");

  $effect(() => {
    const id = gameId;
    liveProgress = undefined;
    announcement = "";
    let announcedDecile = -1;
    return onAnalyseProgress((p) => {
      if (p.gameId !== id) return;
      liveProgress = { ply: p.ply, total: p.total };
      if (p.total <= 0) return;
      const decile = Math.floor((p.ply / p.total) * 10);
      if (decile > announcedDecile) {
        announcedDecile = decile;
        announcement = decile === 0 ? "Analysis started" : `Analysis ${decile * 10} percent`;
      }
    });
  });

  const percent = $derived(liveProgress && liveProgress.total > 0 ? Math.round((liveProgress.ply / liveProgress.total) * 100) : undefined);

  async function analyse(force: boolean): Promise<void> {
    busy = true;
    requestError = undefined;
    try {
      await apiPost("analyse/queue", { gameIds: [gameId], depth: selectedDepth, force });
      onQueued();
    } catch (e) {
      requestError = e instanceof ApiError ? e.message : "unexpected error";
    } finally {
      busy = false;
    }
  }
</script>

{#snippet depthChooser()}
  <div class="field">
    <span class="legend">Depth {SEARCH_DEPTH[selectedDepth]}</span>
    <div class="segmented" role="radiogroup" aria-label="Analysis depth">
      {#each ["quick", "standard", "deep"] as const as preset (preset)}
        <label class="segment" class:selected={selectedDepth === preset}>
          <input type="radio" name="depth" checked={selectedDepth === preset} onchange={() => (selectedDepth = preset)} />
          {DEPTH_LABEL[preset]}
        </label>
      {/each}
    </div>
  </div>
{/snippet}

<div class="card panel">
  {#if analysisStatus === "none"}
    <p>Not analysed yet. Analyse it for the eval graph, move ratings, accuracy and key moments.</p>
    {@render depthChooser()}
    <button type="button" class="primary" class:spinning={busy} disabled={busy} onclick={() => analyse(false)}>
      {#if busy}<Icon name="sync" size={16} />Analysing…{:else}Analyse this game{/if}
    </button>
  {:else if analysisStatus === "queued"}
    <p><strong>Waiting in the queue…</strong></p>
    <div class="progress" role="progressbar" aria-label="Analysis progress" aria-valuemin="0" aria-valuemax="100">
      <div class="fill" style="width: 4%"></div>
    </div>
  {:else if analysisStatus === "running"}
    <p><strong>{percent === undefined ? "Analysing…" : `Analysing… ${percent}%`}</strong></p>
    <div class="progress" role="progressbar" aria-label="Analysis progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow={percent ?? 0}>
      <div class="fill" style={`width: ${percent ?? 4}%`}></div>
    </div>
    {#if liveProgress}
      <p class="muted">Position {liveProgress.ply} of {liveProgress.total}.</p>
    {/if}
    <p class="muted">
      The graph fills in as the engine goes; moves and classifications appear when it is done. You can leave this page, the analysis
      keeps running.
    </p>
    <p class="sr-only" role="status">{announcement}</p>
  {:else if analysisStatus === "error"}
    <div class="error-card" role="alert">
      <h2>The analysis failed.</h2>
      <p>The engine could not finish this game. You can try again.</p>
    </div>
    {@render depthChooser()}
    <button type="button" class="primary" class:spinning={busy} disabled={busy} onclick={() => analyse(true)}>
      {#if busy}<Icon name="sync" size={16} />Retrying…{:else}Retry analysis{/if}
    </button>
  {/if}

  {#if requestError}
    <div class="error-card" role="alert">
      <h2>Could not start the analysis.</h2>
      <p>{requestError}</p>
    </div>
  {/if}
</div>

<style>
  .panel {
    margin-top: 16px;
  }
  .muted {
    color: var(--muted);
    font-size: 12px;
    margin-top: 8px;
  }
  .field {
    margin-top: 12px;
  }
  .legend {
    display: block;
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 8px;
  }
  .segmented {
    display: flex;
    border: 1px solid var(--line);
    border-radius: 12px;
    overflow: hidden;
  }
  .segment {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 44px;
    font-size: 15px;
    cursor: pointer;
    border-right: 1px solid var(--line);
  }
  .segment:last-child {
    border-right: none;
  }
  .segment.selected {
    background: color-mix(in srgb, var(--brand) 16%, var(--surface));
    font-weight: 600;
    box-shadow: inset 0 -3px 0 var(--brand);
  }
  .segment input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }
  .progress {
    margin-top: 12px;
    height: 10px;
  }
</style>
