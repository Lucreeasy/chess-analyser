<script lang="ts">
  import type { Axis, Archetype } from "../../server/insights/playstyle.ts";
  import { ordinal } from "../../server/insights/playstyle.ts";
  import { one, pct } from "../lib/format.ts";
  import type { DrillLink } from "../lib/insightsLinks.ts";
  import BarRow from "./BarRow.svelte";

  /** docs/04-INSIGHTS-SPEC.md section 12.7; docs/07-UI-SPEC.md section 7 (radar). */
  let { axes, archetype, link }: { axes: Axis[]; archetype?: Archetype; link: (axis: Axis) => DrillLink | undefined } = $props();

  // The radar: centre (210, 150), 90 px for a score of 100, the first axis at the top, clockwise; a tight
  // view box keeps the 12 px labels readable when the chart shrinks to a phone's width.
  const point = (i: number, value: number) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / axes.length;
    return [210 + Math.cos(angle) * value * 0.9, 150 + Math.sin(angle) * value * 0.9];
  };
  const polygon = (value: (i: number) => number) => axes.map((_, i) => point(i, value(i)).join(",")).join(" ");
  const rounded = (a: Axis) => (a.value === undefined ? "no data" : String(Math.round(a.value)));
  const summary = $derived(`Radar chart, 0 to 100: ${axes.map((a) => `${a.short} ${rounded(a)}`).join(", ")}`);
  const label = (key: string) => axes.find((a) => a.key === key)!;

  /** Section 12.7's raw formats in the axis breakdown. */
  function raw(input: Axis["inputs"][number]): string {
    if (input.raw === undefined) return "no data";
    switch (input.unit) {
      case "perMove":
        return `${input.raw.toFixed(2)} per move`;
      case "share":
        return pct(input.raw);
      case "per100":
        return `${one(input.raw)} per 100 moves`;
      case "winPoints":
        return `${one(input.raw)} points`;
      case "accuracy":
        return `${one(input.raw)}%`;
    }
  }
</script>

<div class="playstyle">
  <div>
    <svg viewBox="30 0 360 290" role="img" aria-label={summary}>
      {#each [25, 50, 75, 100] as ring (ring)}
        <polygon class="grid" points={polygon(() => ring)} />
      {/each}
      {#each axes as _, i (i)}
        <line class="grid" x1="210" y1="150" x2={point(i, 100)[0]} y2={point(i, 100)[1]} />
      {/each}
      <polygon class="data" points={polygon((i) => axes[i].value ?? 0)} />
      {#each axes as a, i (a.key)}
        {@const [x, y] = point(i, a.value ?? 0)}
        <circle cx={x} cy={y} r="3.5" class="dot" />
        {@const [lx, ly] = point(i, 122)}
        <text x={lx} y={i === 0 ? ly - 14 : ly} text-anchor={Math.abs(lx - 210) < 1 ? "middle" : lx > 210 ? "start" : "end"}>
          <tspan class="name" x={lx}>{a.short}</tspan>
          <tspan class="value" x={lx} dy="14">{rounded(a)}</tspan>
        </text>
      {/each}
    </svg>

    <div class="inset archetype">
      {#if archetype}
        <p class="caps">Your style</p>
        <p class="name">{archetype.label}</p>
        <p>{archetype.description}</p>
        <p class="muted-line">
          Weakest axis: <strong>{label(archetype.weakest).label}</strong> ({rounded(label(archetype.weakest))}) — the one to work on.
        </p>
        {#if archetype.pair}
          <p class="fine">From your two highest axes: {label(archetype.pair[0]).short} + {label(archetype.pair[1]).short}.</p>
        {/if}
      {:else}
        <p class="name">No archetype yet</p>
        <p>At least two axes need data to name a playing style.</p>
      {/if}
    </div>
  </div>

  <ul class="axes">
    {#each axes as a (a.key)}
      <li>
        <BarRow label={a.label} value={rounded(a)} bar={a.value ?? 0} link={link(a)} />
        {#each a.inputs as input (input.label)}
          <p class="input">
            <span>{input.label}</span>
            <span><strong>{raw(input)}</strong>{input.percentile !== undefined ? ` · ${ordinal(Math.round(input.percentile))} pct.` : ""}</span>
          </p>
        {/each}
        <details>
          <summary>What this means</summary>
          <p>{a.explanation}</p>
        </details>
      </li>
    {/each}
  </ul>
</div>

<style>
  .playstyle {
    display: grid;
    gap: 16px;
    margin-top: 12px;
  }
  @media (min-width: 768px) {
    .playstyle {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    }
  }
  svg {
    display: block;
    width: 100%;
    max-width: 360px;
    height: 290px;
    margin: 0 auto;
  }
  .grid {
    fill: none;
    stroke: var(--line);
  }
  .data {
    fill: color-mix(in srgb, var(--brand) 28%, transparent);
    stroke: var(--brand);
    stroke-width: 2.5;
  }
  .dot {
    fill: var(--brand);
  }
  text {
    font-size: 12px;
  }
  .name {
    font-weight: 600;
    fill: var(--ink);
  }
  .value {
    fill: var(--muted);
  }
  .caps {
    color: var(--muted);
    font-size: 12px;
    text-transform: uppercase;
  }
  .archetype .name {
    font-size: 24px;
    line-height: 32px;
    font-weight: 600;
  }
  .muted-line {
    margin-top: 8px;
    color: var(--muted);
  }
  .muted-line strong {
    color: var(--ink);
  }
  .axes {
    display: grid;
    gap: 16px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .input {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    margin-top: 4px;
    padding: 0 4px;
    color: var(--muted);
    font-size: 12px;
    line-height: 1.4;
  }
  .input > span:last-child {
    flex: none; /* the value stays on one line; the label wraps */
  }
  .input strong {
    color: var(--ink);
    font-weight: 500;
  }
  details {
    margin-top: 8px;
    padding: 0 4px;
    font-size: 12px;
    color: var(--muted);
  }
  summary {
    color: inherit; /* "What this means" is plain text (docs/07-UI-SPEC.md section 5.17) */
  }
  details p {
    margin-top: 4px;
    font-size: 14px;
    color: var(--ink);
  }
</style>
