<script lang="ts">
  import type { computeInsights } from "../../server/insights/insights.ts";
  import { accuracyText, pct, thousands } from "../lib/format.ts";
  import type { DrillLink } from "../lib/insightsLinks.ts";
  import { viewport } from "../lib/viewport.svelte.ts";
  import { compareValues } from "../lib/gamesSort.ts";
  import Badge from "./Badge.svelte";
  import Icon from "./Icon.svelte";

  type Row = Extract<ReturnType<typeof computeInsights>, { ready: true }>["openings"]["white"][number];

  /** One colour's opening table. */
  let { rows, side, link }: { rows: Row[]; side: "White" | "Black"; link: (row: Row) => DrillLink | undefined } = $props();

  const COLUMNS = [
    { key: "family", label: "Opening", short: "Opening" },
    { key: "games", label: "Games", short: "Games" },
    { key: "score", label: "Score", short: "Score" },
    { key: "accuracy", label: "Accuracy, plies 1-20", short: "Acc. 1-20" },
    { key: "ep20", label: "Avg. win chance at ply 20", short: "EP @20" },
  ] as const;
  type Key = (typeof COLUMNS)[number]["key"];

  let key: Key = $state("games");
  let desc = $state(true);
  let all = $state(false);

  /** A new column starts descending (Opening ascending); the active one reverses. */
  function sortBy(next: Key): void {
    desc = next === key ? !desc : next !== "family";
    key = next;
  }
  const value = (r: Row, k: Key) => (k === "family" ? r.family : k === "games" ? r.games : r[k].value);
  // Ties fall back to games descending, then the server's order (family ascending).
  const sorted = $derived([...rows].sort((a, b) => compareValues(value(a, key), value(b, key), desc ? "desc" : "asc") || b.games - a.games));
  const shown = $derived(all ? sorted : sorted.slice(0, 8));

  const FLAG = {
    problem: { tone: "danger", mark: "▼", label: "Problem", tip: "Score under 40% and a worse position by ply 20" },
    strong: { tone: "ok", mark: "▲", label: "Strong", tip: "Score over 60%" },
  } as const;
  const cell = (r: Row, k: Key, phone = false) =>
    k === "family"
      ? r.family
      : k === "games"
        ? thousands(r.games)
        : k === "accuracy"
          ? phone && r.accuracy.value !== undefined
            ? String(Math.round(r.accuracy.value))
            : accuracyText(r.accuracy.value)
          : pct(r[k].value);
</script>

{#snippet flag(f: "problem" | "strong")}
  <Badge tone={FLAG[f].tone} mark={FLAG[f].mark} label={FLAG[f].label} title={FLAG[f].tip} outline />
{/snippet}

<h3>As {side}</h3>
{#if rows.length === 0}
  <p class="muted">No named openings as {side} in this selection.</p>
{:else}
  {#if viewport.isDesktop}
    <table>
      <thead>
        <tr>
          {#each COLUMNS as c (c.key)}
            <th scope="col" class:num={c.key !== "family"} aria-sort={c.key === key ? (desc ? "descending" : "ascending") : "none"}>
              <button type="button" onclick={() => sortBy(c.key)}>
                {c.label}
                <Icon name={c.key !== key ? "sortBoth" : desc ? "sortDesc" : "sortAsc"} size={14} />
              </button>
            </th>
          {/each}
          <th scope="col"><span class="sr-only">Flag</span></th>
        </tr>
      </thead>
      <tbody>
        {#each shown as r (r.family)}
          {@const drill = link(r)}
          <tr class={r.flag}>
            {#each COLUMNS as c (c.key)}
              <td class:num={c.key !== "family"}>
                <a href={drill?.href} title={drill?.hint}>{cell(r, c.key)}</a>
              </td>
            {/each}
            <td>{#if r.flag}{@render flag(r.flag)}{/if}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  {:else}
    <div class="sort">
      <label>
        <span>Sort by</span>
        <select value={key} onchange={(e) => sortBy(e.currentTarget.value as Key)}>
          {#each COLUMNS as c (c.key)}<option value={c.key}>{c.short}</option>{/each}
        </select>
      </label>
      <button type="button" class="neutral" onclick={() => (desc = !desc)}>
        <Icon name={desc ? "sortDesc" : "sortAsc"} size={16} />{desc ? "Desc" : "Asc"}
      </button>
    </div>
    <ul class="cards">
      {#each shown as r (r.family)}
        {@const drill = link(r)}
        <li>
          <a class="tile drill {r.flag ?? ''}" href={drill?.href} title={drill?.hint}>
            <span class="head">
              <span class="name">{r.family}</span>
              {#if r.flag}{@render flag(r.flag)}{/if}
              <Icon name="chevronRight" size={18} />
            </span>
            <span class="mini">
              {#each COLUMNS.slice(1) as c (c.key)}
                <span><span class="label">{c.short}</span><span class="v">{cell(r, c.key, true)}</span></span>
              {/each}
            </span>
          </a>
        </li>
      {/each}
    </ul>
  {/if}
  {#if rows.length > 8}
    <button type="button" class="neutral small more" onclick={() => (all = !all)}>{all ? "Show fewer" : `Show all ${rows.length}`}</button>
  {/if}
{/if}

<style>
  h3 {
    margin: 16px 0 8px;
    font-size: 16px;
    font-weight: 500;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
  }
  th {
    padding: 0;
    color: var(--muted);
    font-weight: 400;
    text-align: left;
    border-bottom: 1px solid var(--line);
  }
  td {
    padding: 0 12px;
    border-bottom: 1px solid var(--line);
  }
  td a {
    display: inline-block;
    padding: 12px 0;
    color: var(--ink);
    text-decoration: underline dotted var(--brand);
    text-underline-offset: 4px;
  }
  .num {
    text-align: right;
  }
  .problem {
    background: color-mix(in srgb, var(--danger) 9%, transparent);
  }
  .strong {
    background: color-mix(in srgb, var(--ok) 9%, transparent);
  }
  .sort {
    display: flex;
    align-items: flex-end;
    gap: 8px;
    margin-bottom: 8px;
  }
  .sort label {
    flex: 1;
    display: grid;
    gap: 4px;
    font-size: 12px;
    color: var(--muted);
  }
  .cards {
    display: grid;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .head {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .name {
    flex: 1;
    font-size: 16px;
    font-weight: 600;
  }
  .mini {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    margin-top: 8px;
    text-align: center;
  }
  .mini > span > span {
    display: block;
  }
  .label {
    color: var(--muted);
    font-size: 11px;
  }
  .v {
    font-size: 16px;
    font-weight: 600;
  }
  .more {
    margin-top: 8px;
  }
</style>
