<script lang="ts">
  import { dotsFor, nearestPly, sliderValueText, accessibleSummary } from "../lib/evalGraph.ts";
  import { CLASS_VISUALS } from "../lib/classVisuals.ts";
  import { CLASS_INFO } from "../../server/analysis/texts.ts";
  import type { MoveClass } from "../../server/analysis/classification.ts";

  let {
    winPercents,
    classifications,
    currentPly,
    onJump,
    height = 80,
  }: {
    /** Length N+1, ply 0..N; undefined entries are gaps (live analysis still in progress). */
    winPercents: (number | undefined)[];
    classifications: (MoveClass | undefined)[];
    currentPly: number;
    onJump: (ply: number) => void;
    /** docs/07-UI-SPEC.md section 7: 80 desktop (default), 40 collapsed phone sheet, 96 expanded sheet. */
    height?: number;
  } = $props();

  const WIDTH = 400;
  const HEIGHT = $derived(height);
  // docs/07-UI-SPEC.md section 7: dots are 9px; a diamond's diagonal (not its side) is what reads as 9px.
  const DIAMOND_SIDE = 9 / Math.SQRT2;

  const plyCount = $derived(Math.max(0, winPercents.length - 1));
  const dots = $derived(dotsFor(winPercents, classifications));
  const valueText = $derived(sliderValueText(currentPly, plyCount, winPercents[currentPly]));
  const summaryText = $derived(accessibleSummary(winPercents, classifications));

  function xOf(ply: number): number {
    return plyCount === 0 ? 0 : (ply / plyCount) * WIDTH;
  }
  function yOf(winPercent: number): number {
    return HEIGHT - (winPercent / 100) * HEIGHT;
  }

  // docs/06-GAMES-SPEC.md section B4: "gaps are allowed and break the line" - one segment per run of known values.
  const segments = $derived.by(() => {
    const segs: { ply: number; w: number }[][] = [];
    let current: { ply: number; w: number }[] = [];
    for (let ply = 0; ply <= plyCount; ply++) {
      const w = winPercents[ply];
      if (w === undefined) {
        if (current.length > 0) segs.push(current);
        current = [];
      } else {
        current.push({ ply, w });
      }
    }
    if (current.length > 0) segs.push(current);
    return segs;
  });

  function areaPath(seg: { ply: number; w: number }[]): string {
    const top = seg.map((p) => `${xOf(p.ply)},${yOf(p.w)}`).join(" L ");
    const first = seg[0]!;
    const last = seg[seg.length - 1]!;
    return `M ${xOf(first.ply)},${HEIGHT} L ${top} L ${xOf(last.ply)},${HEIGHT} Z`;
  }
  function linePath(seg: { ply: number; w: number }[]): string {
    return `M ${seg.map((p) => `${xOf(p.ply)},${yOf(p.w)}`).join(" L ")}`;
  }

  function moveNumberOf(ply: number): number {
    return Math.ceil(ply / 2);
  }

  let svgEl: SVGSVGElement;
  function jumpFromEvent(e: MouseEvent): void {
    const rect = svgEl.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * WIDTH;
    onJump(nearestPly(x, WIDTH, plyCount));
  }

  function onKeydown(e: KeyboardEvent): void {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      onJump(Math.max(0, currentPly - 1));
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      onJump(Math.min(plyCount, currentPly + 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      onJump(0);
    } else if (e.key === "End") {
      e.preventDefault();
      onJump(plyCount);
    }
  }
</script>

<div class="graph-wrap">
  <svg
    bind:this={svgEl}
    viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
    preserveAspectRatio="none"
    class="graph"
    style={`height: ${height}px`}
    role="slider"
    tabindex="0"
    aria-label="Evaluation graph. Tap to jump to a move."
    aria-valuemin="0"
    aria-valuemax={plyCount}
    aria-valuenow={currentPly}
    aria-valuetext={valueText}
    onclick={jumpFromEvent}
    onkeydown={onKeydown}
  >
    <rect x="0" y="0" width={WIDTH} height={HEIGHT} class="bg" />
    {#each segments as seg, i (i)}
      <path d={areaPath(seg)} class="area" />
    {/each}
    <line x1="0" y1={HEIGHT / 2} x2={WIDTH} y2={HEIGHT / 2} class="mid-line" />
    {#each segments as seg, i (i)}
      <path d={linePath(seg)} class="curve" fill="none" />
    {/each}
    {#each dots as dot (dot.ply)}
      {#if dot.shape === "diamond"}
        <rect
          x={xOf(dot.ply) - DIAMOND_SIDE / 2}
          y={yOf(dot.winPercent) - DIAMOND_SIDE / 2}
          width={DIAMOND_SIDE}
          height={DIAMOND_SIDE}
          transform={`rotate(45 ${xOf(dot.ply)} ${yOf(dot.winPercent)})`}
          class="dot"
          style={`fill: var(${CLASS_VISUALS[dot.cls].cssVar})`}
        >
          <title>{CLASS_INFO[dot.cls].label}, move {moveNumberOf(dot.ply)}</title>
        </rect>
      {:else}
        <circle cx={xOf(dot.ply)} cy={yOf(dot.winPercent)} r="4.5" class="dot" style={`fill: var(${CLASS_VISUALS[dot.cls].cssVar})`}>
          <title>{CLASS_INFO[dot.cls].label}, move {moveNumberOf(dot.ply)}</title>
        </circle>
      {/if}
    {/each}
    <line x1={xOf(currentPly)} y1="0" x2={xOf(currentPly)} y2={HEIGHT} class="marker" />
  </svg>
  <p class="sr-only">{summaryText}</p>
</div>

<style>
  .graph-wrap {
    margin-top: 12px;
  }
  .graph {
    display: block;
    width: 100%;
    height: 80px;
    border: 1px solid var(--line);
    border-radius: 8px;
    cursor: pointer;
  }
  .bg {
    fill: var(--eval-black);
  }
  .area {
    fill: var(--eval-white);
  }
  .mid-line {
    stroke: var(--eval-mid);
    stroke-width: 1;
  }
  .curve {
    stroke: var(--eval-line);
    stroke-width: 1.5;
  }
  .dot {
    stroke: var(--eval-dot-ring);
    stroke-width: 1.5;
  }
  .marker {
    stroke: var(--accent);
    stroke-width: 2;
  }
</style>
