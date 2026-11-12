<script lang="ts">
  import type { computeInsights } from "../../server/insights/insights.ts";
  import type { Stat } from "../../server/insights/overview.ts";
  import { ALL_PHASES } from "../../server/analysis/phases.ts";
  import { ALL_TAGS } from "../../server/analysis/tacticTags.ts";
  import { TAG_INFO } from "../../server/analysis/texts.ts";
  import { apiGet } from "../lib/api.ts";
  import { route, navigate } from "../lib/router.svelte.ts";
  import { queue } from "../lib/live.svelte.ts";
  import { currentCount, queueVisible } from "../lib/queueStatus.ts";
  import { accuracyText, one, pct, plural, thousands, ukDate } from "../lib/format.ts";
  import { drillLink, insightsParams } from "../lib/insightsLinks.ts";
  import { activeFilterCount, filtersFromQuery, type GamesFilters } from "../lib/gamesFilter.ts";
  import FilterPanel from "../components/FilterPanel.svelte";
  import Badge from "../components/Badge.svelte";
  import Logo from "../components/Logo.svelte";
  import StatTile from "../components/StatTile.svelte";
  import Recommendations from "../components/Recommendations.svelte";
  import Playstyle from "../components/Playstyle.svelte";
  import BarRow from "../components/BarRow.svelte";
  import Chart from "../components/Chart.svelte";
  import Trend from "../components/Trend.svelte";
  import OpeningsTable from "../components/OpeningsTable.svelte";
  import Icon from "../components/Icon.svelte";

  type Insights = ReturnType<typeof computeInsights>;

  /** docs/04-INSIGHTS-SPEC.md section 8.2: one decimal below 10, whole from 10 ("4.3 s", "12 s"). */
  const secs = (s: number | undefined) => (s === undefined ? "–" : `${s < 10 ? one(s) : Math.round(s)} s`);

  /** "{count} of {n} {noun}s", the sub-line of a share. */
  const ofN = (s: Stat, noun: string) => `${thousands(s.count ?? 0)} of ${plural(s.n, noun)}`;

  /** docs/04-INSIGHTS-SPEC.md section 9.2: the texts of the two gauges. */
  const GAUGES = [
    {
      key: "conversion",
      title: "Converting winning positions",
      rate: "Winning positions won",
      rateList: "conversion:won",
      sub: (rate: Stat) => `won ${ofN(rate, "winning position")}`,
      empty: "No game in this selection reached a winning position (80% win chance or more). Nothing to measure yet.",
      reachedLabel: "Games that reached a winning position",
    },
    {
      key: "resilience",
      title: "Saving losing positions",
      rate: "Losing positions saved",
      rateList: "resilience:saved",
      sub: (rate: Stat) => `saved ${ofN(rate, "losing position")} (won or drawn)`,
      empty: "No game in this selection fell into a losing position (20% win chance or less). Nothing to measure yet.",
      reachedLabel: "Games that reached a losing position",
    },
  ] as const;

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
      if (q === query) loading = false; // an older request finishing must not end a newer one's "updating…"
    }
  }

  $effect(() => {
    load(query);
  });

  const filtersActive = $derived(query !== "");

  // Section 3.1: the filter panel edits the address, which drives the request.
  const filters = $derived(filtersFromQuery(query));
  const filterCount = $derived(activeFilterCount(filters));
  let showFilters = $state(false);
  function applyFilters(f: GamesFilters): void {
    const colour = f.colour === "any" ? undefined : f.colour;
    const params = insightsParams({ timeClasses: [...f.timeClasses], colour, family: f.openingFamily, from: f.from, to: f.to });
    if (f.allTime) params.set("allTime", "1");
    navigate(`/insights${params.size ? `?${params}` : ""}`);
  }

  // Section 4.1: the count line and, while the default range is in use, the line explaining it.
  const countLine = $derived.by(() => {
    if (!data) return "";
    const base = `${plural(data.analysed, "analysed game")}${data.analysed !== data.gamesTotal ? ` of ${thousands(data.gamesTotal)} matching` : ""}`;
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
    <button
      type="button"
      class="neutral phone-only filters-button"
      aria-expanded={showFilters}
      aria-controls="insights-filters"
      onclick={() => (showFilters = !showFilters)}
    >
      <Icon name="filter" size={18} />Filters
      {#if filterCount > 0}<Badge tone="brand" label={String(filterCount)} />{/if}
      <span class="toggle">{showFilters ? "Hide" : "Show"}</span>
    </button>
    <div id="insights-filters" class="filters" class:hidden-on-phone={!showFilters}>
      <FilterPanel
        bind:filters={() => filters, applyFilters}
        facets={{
          timeClasses: new Set(data.library.hasClassical ? ["classical"] : []),
          openingFamilies: data.library.families.map((f) => ({ family: f.name, count: f.count })),
        }}
        insights
        defaultFrom={data.defaultRange?.from}
      />
    </div>
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
        <li>{plural(data.gamesTotal, "game")} {data.gamesTotal === 1 ? "matches" : "match"} the current filters.</li>
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
        <a class="primary" href="#/games?analysis=not_analysed">Analyse more games</a>
        {#if filtersActive}
          <button type="button" class="neutral" onclick={() => navigate("/insights")}>Clear filters</button>
        {/if}
      </div>
    </section>
  {:else}
    {@const o = data.overview}
    {@const time = data.time}
    <!-- Section 6: the error bars of the three phases share one scale. -->
    {@const errorScale = Math.max(10, ...ALL_PHASES.map((p) => o.errorsByPhase[p].all.value ?? 0))}
    {@const link = (key: string, label: string, exact = false) => drillLink(data.lists[key], label, data.filters, exact)}
    <div class="dashboard" class:dimmed={loading} aria-busy={loading}>
      <!-- docs/04-INSIGHTS-SPEC.md section 5. -->
      <section id="overall">
        <h2>Overall</h2>
        <p class="muted">{thousands(o.games)} analysed games and {thousands(o.moves)} of your moves.</p>
        <div class="tiles">
          <StatTile label="Accuracy" value={accuracyText(o.accuracy.value)} sub="mean over your games" link={link("all", "All analysed games", true)} />
          <StatTile
            label="Errors per 100 moves"
            value={one(o.errors.all.value)}
            sub={`${thousands(o.errors.all.count ?? 0)} errors; ${one(o.errors.blunder.value)} blunders`}
            link={link("error:all", "Games with errors")}
          />
          <StatTile
            label="Punish rate"
            value={pct(o.punish.value)}
            sub={`answered ${o.punish.count} of ${o.punish.n} opponent errors`}
            link={link("punish:opportunities", "Games with an opponent error to punish")}
          />
          <StatTile
            label="Consistency"
            value={o.consistency.value === undefined ? "–" : `± ${one(o.consistency.value)}`}
            sub="spread of game accuracy; lower is steadier"
            link={link("all", "All analysed games", true)}
          />
        </div>
      </section>

      <section id="playstyle" class="card">
        <h2>Playstyle</h2>
        <p class="muted">Five axes scored 0-100 against typical club players, and the playing style they add up to.</p>
        <Playstyle
          axes={data.playstyle.axes}
          archetype={data.playstyle.archetype}
          link={(axis) => link("all", `${axis.label} (all analysed games)`, true)}
        />
      </section>

      <section id="advice" class="card">
        <h2>Recommendations</h2>
        <p class="muted">What to work on first, based on patterns across your games. Every card points to real positions.</p>
        <Recommendations recommendations={data.recommendations} />
      </section>

      {#if data.trend.length > 0}
        <section id="trend" class="card">
          <h2>Accuracy trend</h2>
          <p class="muted">Your average accuracy over a rolling window of 20 games. Are you improving?</p>
          <Trend points={data.trend} filters={data.filters} />
        </section>
      {/if}

      <section id="phases" class="card">
        <h2>Phases</h2>
        <p class="muted">How accurately you play, and how often you err, in the opening, middlegame and endgame.</p>
        <div class="cols">
          {#each ALL_PHASES as p (p)}
            {@const errors = o.errorsByPhase[p]}
            <div class="col">
              <h3>{p[0].toUpperCase() + p.slice(1)} <span class="muted">{thousands(o.accuracyByPhase[p].n)} moves</span></h3>
              <StatTile
                label="Accuracy"
                value={accuracyText(o.accuracyByPhase[p].value)}
                bar={o.accuracyByPhase[p].value ?? 0}
                link={link(`phase:${p}`, `Games that reached the ${p}`)}
              />
              <StatTile
                label="Errors per 100 moves"
                value={one(errors.all.value)}
                sub={plural(errors.all.count ?? 0, "error")}
                bar={((errors.all.value ?? 0) / errorScale) * 100}
                tone="accent"
                warn={(errors.all.value ?? 0) >= 12}
                link={link(`error:all:${p}`, `Games with errors in the ${p}`)}
              />
              <StatTile
                label="Blunders per 100 moves"
                value={one(errors.blunder.value)}
                sub={plural(errors.blunder.count ?? 0, "blunder")}
                link={link(`error:blunder:${p}`, `Games with blunders in the ${p}`)}
              />
            </div>
          {/each}
        </div>
      </section>

      <section id="openings" class="card">
        <h2>Openings</h2>
        <p class="muted">Your results by opening family: score, accuracy in the first 20 plies and your average win chance (EP) at ply 20.</p>
        {#each [["White", data.openings.white], ["Black", data.openings.black]] as const as [side, rows] (side)}
          <OpeningsTable {side} {rows} link={(r) => link(r.list, `${r.family} as ${side}`, true)} />
        {/each}
        <p class="fine legend">
          ▼ Problem: 8+ games, score under 40% and under 40% win chance at ply 20. ▲ Strong: 8+ games and score over 60%.{data.openings.unnamed > 0
            ? ` ${plural(data.openings.unnamed, "game")} ${data.openings.unnamed === 1 ? "has" : "have"} no named opening.`
            : ""}
        </p>
      </section>

      <section id="time" class="card">
        <h2>Time management</h2>
        <p class="muted">Where your clock goes, and what happens to your moves when you run short.</p>
        <!-- Section 8.2. -->
        {#if time.clocked === 0}
          <p class="inset cols">
            None of the games in this selection have clock times (daily games and PGNs without clock comments), so the time statistics are hidden.
          </p>
        {/if}
        {#if time.clocked > 0 || time.lostOnTime.n > 0}
          <div class="tiles">
            {#if time.clocked > 0}
              <StatTile
                label="Seconds per move"
                value={secs(time.secondsPerMove.value)}
                sub={`${secs(time.secondsPerMoveEarly.value)} in plies 1-20`}
                link={link("time:clocks", "Games with clock times")}
              />
              <StatTile label="Moves under 5 s" value={pct(time.under5s.value)} sub={ofN(time.under5s, "move")} link={link("time:clocks", "Games with clock times")} />
              <StatTile
                label="Games in time trouble"
                value={pct(time.gamesInTrouble.value)}
                sub={ofN(time.gamesInTrouble, "game")}
                link={link("time:trouble", "Games where you entered time trouble")}
              />
            {/if}
            <StatTile label="Lost on time" value={pct(time.lostOnTime.value)} sub={ofN(time.lostOnTime, "loss")} link={link("time:loss", "Games lost on time")} />
          </div>
        {/if}
        {#if time.clocked > 0}
          {@const trouble = time.troubleBlunders}
          {@const normal = time.normalBlunders}
          {@const scale = Math.max(trouble.value ?? 0, normal.value ?? 0, 1)}
          {@const warn = (time.ratio ?? 0) >= 2}
          {#if time.byMoveNumber.length > 0}
            <h3>Average seconds per move, by move number</h3>
            {@const secs = time.byMoveNumber.map((p) => p.seconds.value ?? 0)}
            {@const moves = time.byMoveNumber.map((p) => p.move)}
            <!-- About 7 whole move-number ticks with the first and last; seconds in steps of 1, 2, 5 … 300 s. -->
            {@const xStep = Math.max(1, Math.round((moves[moves.length - 1] - moves[0]) / 6))}
            {@const yStep = [1, 2, 5, 10, 20, 30, 60, 120, 300].find((st) => Math.max(...secs) / st <= 4) ?? 600}
            {@const yTicks = Array.from({ length: Math.max(1, Math.ceil(Math.max(...secs) / yStep)) + 1 }, (_, i) => i * yStep)}
            {@const peak = secs.indexOf(Math.max(...secs))}
            <Chart
              xs={moves}
              xTicks={[...moves.filter((m) => (m - moves[0]) % xStep === 0 && moves[moves.length - 1] - m >= xStep / 2), moves[moves.length - 1]].map(
                (m) => ({ at: m, label: String(m) }),
              )}
              left={{ min: 0, max: yTicks[yTicks.length - 1], ticks: yTicks, format: (v) => `${v} s` }}
              series={[{ values: secs, area: true }]}
              label={`Average seconds per move, by move number. It starts at ${one(secs[0])} s on move ${moves[0]} and peaks at ${one(secs[peak])} s on move ${moves[peak]}.`}
              hover
            >
              {#snippet tip(i)}<strong>Move {moves[i]}</strong><br />{one(secs[i])} s Average{/snippet}
            </Chart>
          {/if}
          <h3>Blunders per 100 moves: time trouble vs not</h3>
          <div class="across">
            <StatTile
              label="In time trouble"
              value={one(trouble.value)}
              sub={`${plural(trouble.count ?? 0, "blunder")} in ${plural(trouble.n, "move")}`}
              bar={((trouble.value ?? 0) / scale) * 100}
              tone={warn ? "danger" : "brand"}
              {warn}
              link={link("time:troubleBlunders", "Games with a blunder in time trouble")}
            />
            <StatTile
              label="With enough time"
              value={one(normal.value)}
              sub={`${plural(normal.count ?? 0, "blunder")} in ${plural(normal.n, "move")}`}
              bar={((normal.value ?? 0) / scale) * 100}
              link={link("time:normalBlunders", "Games with a blunder outside time trouble")}
            />
          </div>
          {#if time.ratio !== undefined}
            <p class="note">
              You blunder <strong>{one(time.ratio)}×</strong> as often when your clock is low (under 10% of the base time or under 10 s).
            </p>
          {/if}
        {/if}
      </section>

      <section id="conversion" class="card">
        <h2>Conversion & resilience</h2>
        <p class="muted">Do you finish off winning positions, and do you save the ones that went wrong?</p>
        <!-- Section 9.2: two gauges with the same layout. -->
        <div class="cols">
          {#each GAUGES as g (g.key)}
            {@const s = data[g.key]}
            <div class="col">
              <h3>{g.title}</h3>
              {#if s.reached.count === 0}
                <p class="inset">{g.empty}</p>
              {:else}
                <StatTile label={g.rate} value={pct(s.rate.value)} sub={g.sub(s.rate)} link={link(g.rateList, g.rate)}>
                  <span
                    class="wdl"
                    role="img"
                    aria-label={`Won ${pct(s.won.value)}, drawn ${pct(s.drawn.value)}, lost ${pct(s.lost.value)}`}
                  >
                    {#each ["won", "drawn", "lost"] as const as part (part)}
                      <span class={part} style={`width: ${(s[part].value ?? 0) * 100}%`}></span>
                    {/each}
                  </span>
                </StatTile>
                <div class="across">
                  {#each ["won", "drawn", "lost"] as const as part (part)}
                    <StatTile
                      label={part[0].toUpperCase() + part.slice(1)}
                      value={thousands(s[part].count ?? 0)}
                      sub={pct(s[part].value)}
                      link={link(`${g.key}:${part}`, `${g.title}: ${part}`)}
                    />
                  {/each}
                </div>
                <StatTile
                  label={g.reachedLabel}
                  value={`${thousands(s.reached.count ?? 0)} of ${thousands(s.reached.n)}`}
                  sub={`${pct(s.reached.value)} of your games`}
                  link={link(`${g.key}:reached`, g.reachedLabel)}
                />
              {/if}
            </div>
          {/each}
        </div>
        <!-- Section 9.3: tilt, only when both sides have a value. -->
        {#if data.tilt.afterLoss.value !== undefined && data.tilt.afterWin.value !== undefined}
          {@const t = data.tilt}
          {@const delta = t.afterLoss.value - t.afterWin.value}
          <h3>After a loss</h3>
          <div class="across">
            <StatTile label="Accuracy after a loss" value={accuracyText(t.afterLoss.value)} sub={plural(t.afterLoss.n, "game")} link={link("tilt:afterLoss", "Games right after a loss")} />
            <StatTile label="Accuracy after a win" value={accuracyText(t.afterWin.value)} sub={plural(t.afterWin.n, "game")} link={link("tilt:afterWin", "Games right after a win")} />
          </div>
          <p class="note">
            {Math.abs(delta) < 0.5
              ? "You play about equally well after a loss and after a win."
              : `You play ${one(Math.abs(delta))} accuracy points ${delta < 0 ? "worse" : "better"} right after a loss.`}
            Only games started within 2 hours of the previous one count.
          </p>
        {/if}
      </section>

      <section id="tactics" class="card">
        <h2>Tactics</h2>
        <p class="muted">What kind of mistake your errors are: a piece left hanging, a missed shot, or just a poor plan.</p>
        {#if o.tactics.positional.n === 0}
          <p class="inset rows">No errors in this selection.</p>
        {:else}
          <!-- Section 14: by count, ties in tag order (the sort is stable); bars scaled to the largest share. -->
          {@const tags = [...ALL_TAGS].sort((a, b) => (o.tactics[b].count ?? 0) - (o.tactics[a].count ?? 0))}
          {@const largest = Math.max(0.01, ...tags.map((t) => o.tactics[t].value ?? 0))}
          <ul class="rows">
            {#each tags as t (t)}
              {@const s = o.tactics[t]}
              {@const drill = link(`tactic:${t}`, `${TAG_INFO[t].label} errors`)}
              <li class:dimmed={!drill}>
                <BarRow
                  label={TAG_INFO[t].label}
                  hint={TAG_INFO[t].hint}
                  value={pct(s.value)}
                  sub={plural(s.count ?? 0, "error")}
                  bar={((s.value ?? 0) / largest) * 100}
                  tone={t === "positional" ? "muted" : "accent"}
                  link={drill}
                />
              </li>
            {/each}
          </ul>
        {/if}
        <a class="neutral small" href="#/puzzles">Practise your own mistakes <Icon name="chevronRight" size={18} /></a>
      </section>
    </div>
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
  .filters-button {
    width: 100%;
  }
  .filters-button .toggle {
    margin-left: auto;
    color: var(--muted);
    font-size: 14px;
    font-weight: 400;
  }
  .filters {
    margin-top: 16px;
  }
  .dimmed {
    opacity: 0.6;
  }
  /* docs/04-INSIGHTS-SPEC.md section 16: Playstyle before Recommendations on the phone, after it on a desktop. */
  .dashboard {
    display: flex;
    flex-direction: column;
    gap: 24px;
    margin-top: 24px;
  }
  @media (min-width: 768px) {
    #overall {
      order: -2;
    }
    #advice {
      order: -1;
    }
  }
  .tiles {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    margin-top: 12px;
  }
  @media (min-width: 1024px) {
    .tiles {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
  }
  h3 {
    font-size: 16px;
    font-weight: 500;
  }
  /* docs/07-UI-SPEC.md section 7: the win/draw/loss bar; patterns, not only colour, tell the parts apart. */
  .wdl {
    display: flex;
    height: 12px;
    margin-top: 6px;
    border-radius: 999px;
    overflow: hidden;
    background: var(--surface-2);
  }
  .wdl .won {
    background: var(--ok);
  }
  .wdl .drawn {
    background: repeating-linear-gradient(90deg, var(--muted) 0 4px, color-mix(in srgb, var(--muted) 55%, var(--surface)) 4px 8px);
  }
  .wdl .lost {
    background: repeating-linear-gradient(135deg, var(--danger) 0 5px, color-mix(in srgb, var(--danger) 55%, var(--surface)) 5px 10px);
  }
  #time h3,
  #conversion > h3 {
    margin: 16px 0 8px;
  }
  /* Side-by-side blocks: stacked on a phone, one equal column per child from 768 px (.cols) or always (.across). */
  .cols {
    display: grid;
    gap: 12px;
    margin-top: 12px;
  }
  .col {
    display: grid;
    gap: 8px;
    align-content: start;
  }
  .across {
    display: grid;
    gap: 8px;
    grid-auto-flow: column;
  }
  .across,
  .cols {
    grid-auto-columns: minmax(0, 1fr);
  }
  @media (min-width: 768px) {
    .cols {
      grid-auto-flow: column;
    }
  }
  .legend {
    margin-top: 12px;
  }
  .note {
    margin-top: 8px;
    font-size: 14px;
  }
  .rows {
    display: grid;
    gap: 12px;
    margin: 12px 0 16px;
    padding: 0;
    list-style: none;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0 8px;
  }
</style>
