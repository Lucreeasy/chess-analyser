<script lang="ts">
  import type { TrendPoint } from "../../server/insights/trend.ts";
  import type { InsightFilters } from "../../server/insights/select.ts";
  import { accuracyText, thousands, ukDate, ukRange } from "../lib/format.ts";
  import { drillLink } from "../lib/insightsLinks.ts";
  import { niceTicks } from "../lib/ticks.ts";
  import Chart from "./Chart.svelte";
  import Icon from "./Icon.svelte";

  /**
   * The rolling accuracy trend: chart, legend, point picker and table. docs/04-INSIGHTS-SPEC.md section 10.2.
   * All points are drawn (at most 300), so the chart, the slider and the table share one index.
   */
  let { points, filters }: { points: TrendPoint[]; filters: InsightFilters } = $props();

  let picked: number | undefined = $state();
  const index = $derived(picked ?? points.length - 1);
  const p = $derived(points[index]);
  const first = $derived(Math.max(1, p.k - p.n + 1));

  const accs = $derived(points.map((q) => q.accuracy));
  const lo = $derived(Math.floor(Math.min(...accs) - 2));
  const hi = $derived(Math.min(100, Math.ceil(Math.max(...accs) + 2)));
  const rated = $derived(points.filter((q) => q.rating !== undefined));
  const ratings = $derived(rated.map((q) => q.rating!));
  const rLo = $derived(Math.floor(Math.min(...ratings) - 20));
  const rHi = $derived(Math.ceil(Math.max(...ratings) + 20));

  // About four time ticks: "3 Oct" for spans up to 150 days, otherwise "Oct 2026".
  const xs = $derived(points.map((q) => q.playedAt));
  const tickFormat = $derived(
    new Intl.DateTimeFormat("en-GB", {
      ...(xs[xs.length - 1] - xs[0] <= 150 * 86_400_000 ? { day: "numeric" } : { year: "numeric" }),
      month: "short",
      timeZone: "UTC",
    }),
  );
  const xTicks = $derived(
    xs.length < 2 ? [] : [0, 1, 2, 3].map((i) => xs[0] + (i * (xs[xs.length - 1] - xs[0])) / 3).map((at) => ({ at, label: tickFormat.format(at) })),
  );

  const lowest = $derived(points.reduce((a, b) => (b.accuracy < a.accuracy ? b : a)));
  const highest = $derived(points.reduce((a, b) => (b.accuracy > a.accuracy ? b : a)));
  const summary = $derived(
    `Rolling accuracy over the last 20 games, ${points.length} points from ${ukDate(points[0].playedAt)} to ${ukDate(points[points.length - 1].playedAt)}. ` +
      `It starts at ${accuracyText(points[0].accuracy)} and ends at ${accuracyText(points[points.length - 1].accuracy)}; ` +
      `lowest ${accuracyText(lowest.accuracy)} (${ukDate(lowest.playedAt)}), highest ${accuracyText(highest.accuracy)} (${ukDate(highest.playedAt)}).` +
      (rated.length >= 2 ? ` Your average rating moves from ${thousands(Math.round(ratings[0]))} to ${thousands(Math.round(ratings[ratings.length - 1]))}.` : ""),
  );

  // "Show these games": the dashboard's filters plus the window's dates; a list without ids makes drillLink use the filters.
  const show = $derived(
    drillLink({ ids: [], total: p.n }, `Accuracy window: games ${first}-${p.k} (${ukRange(p.from, p.to)})`, { ...filters, from: p.from, to: p.to }, true)!,
  );
  const step = $derived(Math.max(1, Math.floor(points.length / 8)));
  const tableRows = $derived(points.filter((_, i) => i % step === 0 || i === points.length - 1));
</script>

<Chart
  {xs}
  {xTicks}
  left={{ min: lo, max: hi, ticks: niceTicks(lo, hi), format: (v) => `${v}%` }}
  right={rated.length > 0 ? { min: rLo, max: rHi, ticks: niceTicks(rLo, rHi), format: (v) => thousands(v) } : undefined}
  series={[{ values: accs }, ...(rated.length > 0 ? [{ values: points.map((q) => q.rating), right: true, dashed: true }] : [])]}
  label={summary}
  height={240}
  bind:picked={() => index, (i) => (picked = i)}
/>
<p class="fine legend">
  <span class="key"></span>Accuracy
  {#if rated.length > 0}<span class="key dashed"></span>Rating (right axis){/if}
</p>

<div class="inset">
  <label for="trend-pick">Pick a point on the line</label>
  <input id="trend-pick" type="range" min="0" max={points.length - 1} value={index} oninput={(e) => (picked = +e.currentTarget.value)} />
  <p aria-live="polite">
    <strong>{accuracyText(p.accuracy)}</strong> over games {first}-{p.k}, {ukRange(p.from, p.to)}{p.rating !== undefined
      ? `, rating about ${thousands(Math.round(p.rating))}`
      : ""}.
  </p>
  <a class="neutral small" href={show.href} title={show.hint}>Show these games <Icon name="chevronRight" size={18} /></a>
</div>

<details>
  <summary>Show as a table</summary>
  <table class="compact">
    <caption class="sr-only">Rolling accuracy, sampled</caption>
    <thead><tr><th scope="col">Up to</th><th scope="col" class="num">Accuracy</th><th scope="col" class="num">Rating</th></tr></thead>
    <tbody>
      {#each tableRows as q (q.k)}
        <tr>
          <td>{ukDate(q.playedAt)}</td>
          <td class="num">{accuracyText(q.accuracy)}</td>
          <td class="num">{q.rating === undefined ? "–" : thousands(Math.round(q.rating))}</td>
        </tr>
      {/each}
    </tbody>
  </table>
</details>

<style>
  .legend {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 8px 0 12px;
  }
  .key {
    width: 16px;
    border-top: 2.5px solid var(--brand);
  }
  .key.dashed {
    margin-left: 12px;
    border-top: 2px dashed var(--accent);
  }
  label {
    font-weight: 400;
  }
  input {
    width: 100%;
    min-height: 44px;
    accent-color: var(--brand);
  }
  details {
    margin-top: 12px;
  }
</style>
