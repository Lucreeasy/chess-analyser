<script lang="ts">
  import { one } from "../lib/format.ts";

  /**
   * docs/07-UI-SPEC.md section 7, area chart: 200 px high, Brand 2.5 px line over a 22 % fill, about 7 x ticks,
   * a y axis in seconds, a tooltip "Move {n}" / "{s} s Average" for the point nearest the pointer.
   */
  let { points, label }: { points: { move: number; s: number }[]; label: string } = $props();

  // The view box is the pixel size, so the text never scales.
  const HEIGHT = 200;
  const LEFT = 36;
  const RIGHT = 8;
  const BOTTOM = 20;
  const TOP = 8;
  let width = $state(600);
  let picked: number | undefined = $state();

  const first = $derived(points[0].move);
  const last = $derived(points[points.length - 1].move);
  const top = $derived(Math.max(...points.map((p) => p.s)));
  const yStep = $derived([1, 2, 5, 10, 20, 30, 60, 120, 300].find((st) => top / st <= 4) ?? 600);
  const yTicks = $derived(Array.from({ length: Math.max(1, Math.ceil(top / yStep)) + 1 }, (_, i) => i * yStep));
  const yMax = $derived(yTicks[yTicks.length - 1]);
  const xStep = $derived(Math.max(1, Math.round((last - first) / 6)));
  const xTicks = $derived([
    ...Array.from({ length: Math.floor((last - first) / xStep) + 1 }, (_, i) => first + i * xStep).filter((m) => last - m >= xStep / 2),
    last,
  ]);
  const x = (move: number) => LEFT + (last === first ? 0 : ((move - first) / (last - first)) * (width - LEFT - RIGHT));
  const y = (s: number) => TOP + (1 - s / yMax) * (HEIGHT - TOP - BOTTOM);
  const line = $derived(points.map((p) => `${x(p.move)},${y(p.s)}`).join(" L "));
  const peak = $derived(points.reduce((a, b) => (b.s > a.s ? b : a)));

  function pick(e: PointerEvent): void {
    const px = e.clientX - (e.currentTarget as SVGElement).getBoundingClientRect().left;
    picked = points.reduce((best, p, i) => (Math.abs(x(p.move) - px) < Math.abs(x(points[best].move) - px) ? i : best), 0);
  }
</script>

<div class="chart" bind:clientWidth={width}>
  <svg
    viewBox={`0 0 ${width} ${HEIGHT}`}
    height={HEIGHT}
    role="img"
    aria-label={`${label}. It starts at ${one(points[0].s)} s on move ${first} and peaks at ${one(peak.s)} s on move ${peak.move}.`}
    onpointermove={pick}
    onpointerdown={pick}
    onpointerleave={() => (picked = undefined)}
  >
    {#each yTicks as t (t)}
      <line class="grid" class:base={t === 0} x1={LEFT} x2={width - RIGHT} y1={y(t)} y2={y(t)} />
      <text x={LEFT - 6} y={y(t) + 4} text-anchor="end">{t} s</text>
    {/each}
    {#each xTicks as m (m)}
      <text x={x(m)} y={HEIGHT - 4} text-anchor="middle">{m}</text>
    {/each}
    <path class="area" d={`M ${x(first)},${y(0)} L ${line} L ${x(last)},${y(0)} Z`} />
    <path class="line" d={`M ${line}`} />
    {#if picked !== undefined}
      {@const p = points[picked]}
      <line class="marker" x1={x(p.move)} x2={x(p.move)} y1={TOP} y2={y(0)} />
      <circle cx={x(p.move)} cy={y(p.s)} r="5" />
    {/if}
  </svg>
  {#if picked !== undefined}
    {@const p = points[picked]}
    <div class="tooltip" style={`left: ${Math.min(x(p.move) + 8, width - 100)}px`}>
      <strong>Move {p.move}</strong><br />{one(p.s)} s Average
    </div>
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
