<script lang="ts">
  import type { computeInsights } from "../../server/insights/insights.ts";
  import { apiGet } from "../lib/api.ts";
  import { route, navigate } from "../lib/router.svelte.ts";
  import { queue } from "../lib/live.svelte.ts";
  import { currentCount, queueVisible } from "../lib/queueStatus.ts";
  import { plural, ukDate } from "../lib/format.ts";
  import Logo from "../components/Logo.svelte";

  type Insights = ReturnType<typeof computeInsights>;

  /** docs/04-INSIGHTS-SPEC.md section 3.1: the filters live in the address; its query string is the API's. */
  const query = $derived(route.path.includes("?") ? route.path.slice(route.path.indexOf("?") + 1) : "");

  let data: Insights | undefined = $state();
  let loading = $state(false);
  let loadError: string | undefined = $state();

  async function load(q: string): Promise<void> {
    loading = true;
    loadError = undefined;
    try {
      const result = await apiGet<Insights>(`insights${q ? `?${q}` : ""}`);
      if (q === query) data = result; // a later filter change wins
    } catch (e) {
      loadError = e instanceof Error ? e.message : String(e);
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    load(query);
  });

  const filtersActive = $derived(query !== "");

  // Section 4.1: the count line and, while the default range is in use, the line explaining it.
  const countLine = $derived.by(() => {
    if (!data) return "";
    const base = `${plural(data.analysed, "analysed game")}${data.analysed !== data.gamesTotal ? ` of ${data.gamesTotal} matching` : ""}`;
    return loading ? `${base} · updating…` : base;
  });
  const rangeLine = $derived.by(() => {
    const range = data?.defaultRange;
    if (!range) return undefined;
    if (range.kind === "days") return "Showing the last 30 days.";
    if (range.kind === "games")
      return `Showing your last 30 analysed games (since ${ukDate(range.from!)}), because the last 30 days hold fewer than 20.`;
    return "Showing all your analysed games (fewer than 30 so far).";
  });

  // Section 2.1: the not-ready card.
  const progress = $derived(data ? Math.min(100, (data.analysed / 20) * 100) : 0);
  const queueLine = $derived.by(() => {
    const status = queue.status;
    if (!queueVisible(status)) return undefined;
    const current = currentCount(status);
    return status.paused
      ? `The analysis queue is paused at ${current} of ${status.total}.`
      : `Analysing game ${current} of ${status.total} in the background.`;
  });
</script>

<div class="page">
  <h1 class="page-title"><Logo />Insights</h1>
  {#if data}
    <p class="muted" aria-live="polite">{countLine}</p>
    {#if rangeLine}<p class="muted">{rangeLine}</p>{/if}
  {/if}

  {#if !data && loadError}
    <div class="error-card" role="alert">
      <h2>Could not load insights</h2>
      <p>{loadError}</p>
      <button type="button" class="neutral" onclick={() => load(query)}>Try again</button>
    </div>
  {:else if !data}
    <div class="skeleton" aria-busy="true" aria-label="Loading insights"></div>
  {:else if !data.ready}
    <section class="card not-ready">
      <h2>{data.needed} more analysed {data.needed === 1 ? "game" : "games"} needed</h2>
      <p>Your playstyle profile needs at least 20 analysed games, so the averages mean something.</p>
      <p class="progress-text">
        <span>{data.analysed} of 20 analysed</span>
        <span>{Math.round(progress)}%</span>
      </p>
      <div class="progress" role="progressbar" aria-valuemin={0} aria-valuemax={20} aria-valuenow={data.analysed}>
        <div class="fill" style={`width: ${progress}%`}></div>
      </div>
      <ul>
        <li>{data.gamesTotal} {data.gamesTotal === 1 ? "game matches" : "games match"} the current filters.</li>
        {#if data.excluded.notAnalysed > 0}
          <li>{plural(data.excluded.notAnalysed, "game")} still waiting to be analysed.</li>
        {/if}
        {#if data.excluded.tooShort > 0}
          <li>{plural(data.excluded.tooShort, "game")} too short to count (under 3 of your moves).</li>
        {/if}
        {#if data.excluded.noMyColor > 0}
          <li>{plural(data.excluded.noMyColor, "game")} where neither player is you; check your usernames in Settings.</li>
        {/if}
      </ul>
      {#if queueLine}<p class="muted">{queueLine}</p>{/if}
      <div class="actions">
        <a class="primary" href="#/games">Analyse more games</a>
        {#if filtersActive}
          <button type="button" class="neutral" onclick={() => navigate("/insights")}>Clear filters</button>
        {/if}
      </div>
    </section>
  {:else}
    <p class="muted">The dashboard sections follow.</p>
  {/if}
</div>

<style>
  h2 {
    font-size: 18px;
    font-weight: 600;
    margin-bottom: 4px;
  }
  .skeleton {
    height: 320px;
    margin-top: 16px;
    border-radius: 16px;
    background: var(--surface-2);
  }
  .not-ready {
    margin-top: 16px;
  }
  .not-ready ul {
    margin: 12px 0;
    padding-left: 20px;
    font-size: 14px;
  }
  .progress-text {
    display: flex;
    justify-content: space-between;
    font-size: 14px;
    margin-top: 12px;
  }
  .progress {
    height: 12px; /* docs/07-UI-SPEC.md section 5.15 */
    margin-top: 4px;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0 8px;
  }
</style>
