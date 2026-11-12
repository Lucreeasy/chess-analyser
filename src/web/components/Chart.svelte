<script lang="ts">
  import type { Snippet } from "svelte";

  export interface Axis {
    min: number;
    max: number;
    ticks: number[];
    format: (v: number) => string;
  }
  export interface Series {
    values: (number | undefined)[];
    right?: boolean;
    dashed?: boolean;
    area?: boolean;
  }

  /**
   * A line chart over shared x positions: the seconds-per-move area chart and the accuracy trend line.
   * Series 0 is Brand on the left axis; a `right` series is Accent on the right axis. A pointer press picks the
   * nearest point; with `hover` moving the pointer does too, and leaving clears it. `tip` draws a tooltip.
   */
  let {
    xs,
    xTicks,
    left,
    right,
    series,
    label,
    height = 200,
    hover = false,
    picked = $bindable(),
    tip,
  }: {
    xs: number[];
    xTicks: { at: number; label: string }[];
    left: Axis;
    right?: Axis;
    series: Series[];
    label: string;
    height?: number;
    hover?: boolean;
    picked?: number;
    tip?: Snippet<[number]>;
  } = $props();

  // The view box is the pixel size, so the text never scales.
  const LEFT = 40;
  const BOTTOM = 20;
  const TOP = 8;
  const RIGHT = $derived(right ? 44 : 8);
  let width = $state(600);

  const x = (v: number) => LEFT + (xs.length < 2 ? 0 : ((v - xs[0]) / (xs[xs.length - 1] - xs[0])) * (width - LEFT - RIGHT));
  const y = (v: number, a: Axis) => TOP + (1 - (v - a.min) / (a.max - a.min || 1)) * (height - TOP - BOTTOM);
  const path = (s: Series) =>
    xs.flatMap((v, i) => (s.values[i] === undefined ? [] : [`${x(v)},${y(s.values[i]!, s.right ? right! : left)}`])).join(" L ");

  function pick(e: PointerEvent): void {
    const px = e.clientX - (e.currentTarget as SVGElement).getBoundingClientRect().left;
    picked = xs.reduce((best, v, i) => (Math.abs(x(v) - px) < Math.abs(x(xs[best]) - px) ? i : best), 0);
  }
</script>

<div class="chart" bind:clientWidth={width}>
  <svg
    viewBox={`0 0 ${width} ${height}`}
    {height}
    role="img"
    aria-label={label}
    onpointerdown={pick}
    onpointermove={hover ? pick : undefined}
    onpointerleave={hover ? () => (picked = undefined) : undefined}
  >
    {#each left.ticks as t, i (t)}
      <line class="grid" class:base={i === 0} x1={LEFT} x2={width - RIGHT} y1={y(t, left)} y2={y(t, left)} />
      <text class:left={!!right} x={LEFT - 6} y={y(t, left) + 4} text-anchor="end">{left.format(t)}</text>
    {/each}
    {#each right?.ticks ?? [] as t (t)}
      <text class="right" x={width - RIGHT + 6} y={y(t, right!) + 4}>{right!.format(t)}</text>
    {/each}
    {#each xTicks as t (t.at)}
      <text x={x(t.at)} y={height - 4} text-anchor="middle">{t.label}</text>
    {/each}
    {#each series as s, i (i)}
      {#if s.area}
        <path class="area" d={`M ${x(xs[0])},${height - BOTTOM} L ${path(s)} L ${x(xs[xs.length - 1])},${height - BOTTOM} Z`} />
      {/if}
      <path class="line" class:second={s.right} class:dashed={s.dashed} d={`M ${path(s)}`} />
    {/each}
    {#if picked !== undefined}
      <line class="marker" x1={x(xs[picked])} x2={x(xs[picked])} y1={TOP} y2={height - BOTTOM} />
      {#if series[0].values[picked] !== undefined}<circle cx={x(xs[picked])} cy={y(series[0].values[picked]!, left)} r="5" />{/if}
    {/if}
  </svg>
  {#if tip && picked !== undefined}
    <div class="tooltip" style={`left: ${Math.min(x(xs[picked]) + 8, width - 100)}px`}>{@render tip(picked)}</div>
  {/if}
</div>

<style>
  .chart {
    position: relative;
  }
  svg {
    display: block;
    width: 100%;
    touch-action: pan-y;
  }
  text {
    font-size: 11px;
    fill: var(--muted);
  }
  .left {
    fill: var(--brand);
  }
  .right {
    fill: var(--accent);
  }
  .grid {
    stroke: var(--line);
    stroke-dasharray: 3 3;
  }
  .grid.base {
    stroke-dasharray: none;
  }
  .area {
    fill: color-mix(in srgb, var(--brand) 22%, transparent);
  }
  .line {
    fill: none;
    stroke: var(--brand);
    stroke-width: 2.5;
    stroke-linejoin: round;
  }
  .line.second {
    stroke: var(--accent);
    stroke-width: 2;
  }
  .line.dashed {
    stroke-dasharray: 6 4;
  }
  .marker {
    stroke: var(--ink);
    stroke-dasharray: 2 3;
  }
  circle {
    fill: var(--brand);
  }
  .tooltip {
    position: absolute;
    top: 0;
    padding: 6px 8px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--surface);
    font-size: 12px;
    pointer-events: none;
  }
</style>
