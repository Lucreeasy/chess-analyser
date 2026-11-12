<script lang="ts">
  import { ALL_TIME_CLASSES } from "../../server/import/timeClass.ts";
  import { activeFilterCount, defaultFilters, type GamesFilters, type Facets } from "../lib/gamesFilter.ts";
  import { timeClassLabel } from "../lib/format.ts";
  import type { TimeClass } from "../lib/types.ts";

  /**
   * The filter panel of the Games library, or with `insights` of the Insights screen (docs/04-INSIGHTS-SPEC.md
   * section 3.1): no result or analysis filter, and a date range group with presets; `defaultFrom` is the default
   * range's start, shown while no dates are set and "All time" is not chosen.
   */
  let {
    filters = $bindable(),
    facets,
    insights = false,
    defaultFrom,
  }: { filters: GamesFilters; facets: Facets; insights?: boolean; defaultFrom?: number } = $props();

  const DAY = 86_400_000;
  const from = $derived(filters.from ?? (filters.allTime ? undefined : defaultFrom));
  /** A preset's from: the start of the UTC day that many days ago. */
  const presetFrom = (days: number) => Math.floor((Date.now() - days * DAY) / DAY) * DAY;

  const timeClassOptions = $derived(ALL_TIME_CLASSES.filter((tc) => tc !== "classical" || facets.timeClasses.has("classical")));

  function toggleTimeClass(tc: TimeClass): void {
    const next = new Set(filters.timeClasses);
    if (next.has(tc)) next.delete(tc);
    else next.add(tc);
    filters = { ...filters, timeClasses: next };
  }

  function toggleResult(result: "win" | "loss" | "draw"): void {
    const next = new Set(filters.results);
    if (next.has(result)) next.delete(result);
    else next.add(result);
    filters = { ...filters, results: next };
  }

  function dateToMs(value: string, endOfDay: boolean): number | undefined {
    if (value === "") return undefined;
    const [year, month, day] = value.split("-").map(Number);
    return endOfDay ? Date.UTC(year!, month! - 1, day!, 23, 59, 59, 999) : Date.UTC(year!, month! - 1, day!);
  }

  function msToDateInput(ms: number | undefined): string {
    if (ms === undefined) return "";
    return new Date(ms).toISOString().slice(0, 10);
  }

  function clearAll(): void {
    filters = { ...defaultFilters(), search: filters.search };
  }

  const count = $derived(activeFilterCount(filters));
</script>

<div class="card panel">
  <div class="field full">
    <span class="label">Time class</span>
    <div class="chips">
      {#each timeClassOptions as tc (tc)}
        <label class="chip" class:pressed={filters.timeClasses.has(tc)}>
          <input type="checkbox" checked={filters.timeClasses.has(tc)} onchange={() => toggleTimeClass(tc)} />
          {timeClassLabel(tc)}
        </label>
      {/each}
    </div>
  </div>

  <div class="field">
    <span class="label">My colour</span>
    <div class="segmented" role="radiogroup" aria-label="My colour">
      {#each [["any", "Any"], ["w", "White"], ["b", "Black"]] as [value, label] (value)}
        <label class="segment" class:selected={filters.colour === value}>
          <input type="radio" name="colour" checked={filters.colour === value} onchange={() => (filters = { ...filters, colour: value as GamesFilters["colour"] })} />
          {label}
        </label>
      {/each}
    </div>
  </div>

  {#if !insights}
  <div class="field">
    <span class="label">Result</span>
    <div class="chips">
      {#each [["win", "Win"], ["loss", "Loss"], ["draw", "Draw"]] as [value, label] (value)}
        <label class="chip" class:pressed={filters.results.has(value as "win" | "loss" | "draw")}>
          <input type="checkbox" checked={filters.results.has(value as "win" | "loss" | "draw")} onchange={() => toggleResult(value as "win" | "loss" | "draw")} />
          {label}
        </label>
      {/each}
    </div>
  </div>

  <div class="field">
    <span class="label">Analysis</span>
    <div class="segmented" role="radiogroup" aria-label="Analysis">
      {#each [["any", "Any"], ["analysed", "Analysed"], ["not_analysed", "Not analysed"]] as [value, label] (value)}
        <label class="segment" class:selected={filters.analysis === value}>
          <input type="radio" name="analysis" checked={filters.analysis === value} onchange={() => (filters = { ...filters, analysis: value as GamesFilters["analysis"] })} />
          {label}
        </label>
      {/each}
    </div>
  </div>

  {/if}

  <div class="field">
    <label for="opening-family" class="label">Opening family</label>
    <select
      id="opening-family"
      value={filters.openingFamily ?? ""}
      onchange={(e) => (filters = { ...filters, openingFamily: e.currentTarget.value === "" ? undefined : e.currentTarget.value })}
    >
      <option value="">Any opening</option>
      {#each facets.openingFamilies as { family, count } (family)}
        <option value={family}>{family} ({count})</option>
      {/each}
    </select>
  </div>

  {#snippet dates()}
  <div class="field">
    <label for="date-from" class="label">From</label>
    <input
      id="date-from"
      type="date"
      max={msToDateInput(filters.to)}
      value={msToDateInput(from)}
      onchange={(e) => (filters = { ...filters, from: dateToMs(e.currentTarget.value, false) })}
    />
  </div>
  <div class="field">
    <label for="date-to" class="label">To</label>
    <input
      id="date-to"
      type="date"
      min={msToDateInput(from)}
      value={msToDateInput(filters.to)}
      onchange={(e) => (filters = { ...filters, to: dateToMs(e.currentTarget.value, true) })}
    />
  </div>

  {/snippet}
  {#if insights}
    <div class="field full">
      <span class="label">Date range</span>
      <div class="chips">
        {#each [["Last 30 days", 30], ["Last 90 days", 90], ["Last 1 year", 365]] as const as [text, days] (days)}
          <button type="button" class="chip" aria-pressed={filters.to === undefined && from === presetFrom(days)} onclick={() => (filters = { ...filters, from: presetFrom(days), to: undefined, allTime: false })}>{text}</button>
        {/each}
        <button type="button" class="chip" aria-pressed={from === undefined && filters.to === undefined} onclick={() => (filters = { ...filters, from: undefined, to: undefined, allTime: true })}>All time</button>
      </div>
      <div class="dates">{@render dates()}</div>
    </div>
  {:else}
    {@render dates()}
  {/if}

  {#if count > 0}
    <button type="button" class="clear full" onclick={clearAll}>Clear all filters</button>
  {/if}
</div>

<style>
  .panel {
    display: grid;
    grid-template-columns: 1fr;
    gap: 16px;
  }
  @media (min-width: 768px) {
    .panel {
      grid-template-columns: repeat(2, 1fr);
    }
  }
  @media (min-width: 1024px) {
    .panel {
      grid-template-columns: repeat(3, 1fr);
    }
  }
  .field.full,
  .clear.full {
    grid-column: 1 / -1;
  }
  .label {
    display: block;
    font-size: 14px;
    font-weight: 500;
    color: var(--muted);
    margin-bottom: 4px;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 44px;
    padding: 0 16px;
    border-radius: 999px;
    border: 1px solid var(--line);
    background: var(--surface);
    font-size: 15px;
    cursor: pointer;
  }
  .chip.pressed,
  .chip[aria-pressed="true"] {
    border-color: var(--brand);
    background: color-mix(in srgb, var(--brand) 16%, var(--surface));
    font-weight: 600;
  }
  .chip input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }
  .dates {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    max-width: 448px;
    margin-top: 12px;
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
  .clear {
    min-height: 44px;
    border: 1px solid var(--line);
    border-radius: 12px;
    background: var(--surface);
    font-size: 14px;
    cursor: pointer;
  }
</style>
