<script lang="ts">
  import type { MoveClass } from "../../server/analysis/classification.ts";
  import { CLASS_INFO } from "../../server/analysis/texts.ts";
  import { CLASS_VISUALS } from "../lib/classVisuals.ts";

  let { cls, size = 18, labelled = false }: { cls: MoveClass; size?: number; labelled?: boolean } = $props();

  const visual = $derived(CLASS_VISUALS[cls]);
  const label = $derived(CLASS_INFO[cls].label);

  /** Points of a regular star (points*2 vertices alternating outer/inner radius), centred on (12,12). */
  function starPoints(points: number, outerR: number, innerR: number): string {
    const coords: string[] = [];
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const angle = (Math.PI * i) / points - Math.PI / 2;
      coords.push(`${(12 + r * Math.cos(angle)).toFixed(2)},${(12 + r * Math.sin(angle)).toFixed(2)}`);
    }
    return coords.join(" ");
  }

  /** Points of a regular polygon, centred on (12,12). */
  function polygonPoints(sides: number, r: number, rotateDeg: number): string {
    const coords: string[] = [];
    for (let i = 0; i < sides; i++) {
      const angle = (2 * Math.PI * i) / sides + (rotateDeg * Math.PI) / 180;
      coords.push(`${(12 + r * Math.cos(angle)).toFixed(2)},${(12 + r * Math.sin(angle)).toFixed(2)}`);
    }
    return coords.join(" ");
  }
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  aria-hidden={labelled ? undefined : "true"}
  role={labelled ? "img" : undefined}
  aria-label={labelled ? label : undefined}
>
  {#if visual.shape === "roundedSquare"}
    <rect x="3" y="3" width="18" height="18" rx="5" fill={`var(${visual.cssVar})`} stroke="#000" stroke-opacity="0.45" stroke-width="1.2" />
  {:else if visual.shape === "circle"}
    <circle cx="12" cy="12" r="9.5" fill={`var(${visual.cssVar})`} stroke="#000" stroke-opacity="0.45" stroke-width="1.2" />
  {:else if visual.shape === "star"}
    <polygon points={starPoints(5, 10, 4.2)} fill={`var(${visual.cssVar})`} stroke="#000" stroke-opacity="0.45" stroke-width="1.2" stroke-linejoin="round" />
  {:else if visual.shape === "burst"}
    <polygon points={starPoints(8, 10, 6.8)} fill={`var(${visual.cssVar})`} stroke="#000" stroke-opacity="0.45" stroke-width="1.2" stroke-linejoin="round" />
  {:else if visual.shape === "diamond"}
    <polygon points={polygonPoints(4, 10, 0)} fill={`var(${visual.cssVar})`} stroke="#000" stroke-opacity="0.45" stroke-width="1.2" stroke-linejoin="round" />
  {:else if visual.shape === "triangle"}
    <polygon points={polygonPoints(3, 10, -90)} fill={`var(${visual.cssVar})`} stroke="#000" stroke-opacity="0.45" stroke-width="1.2" stroke-linejoin="round" />
  {:else if visual.shape === "hexagon"}
    <polygon points={polygonPoints(6, 10, 0)} fill={`var(${visual.cssVar})`} stroke="#000" stroke-opacity="0.45" stroke-width="1.2" stroke-linejoin="round" />
  {:else if visual.shape === "octagon"}
    <polygon points={polygonPoints(8, 10, 22.5)} fill={`var(${visual.cssVar})`} stroke="#000" stroke-opacity="0.45" stroke-width="1.2" stroke-linejoin="round" />
  {/if}

  <g class="ink-{visual.ink}">
    {#if visual.glyph === "book"}
      <path d="M6 8 Q9 6.3 12 8 Q15 6.3 18 8 L18 16 Q15 14.3 12 16 Q9 14.3 6 16 Z" fill="none" stroke="currentColor" stroke-width="1.4" />
      <line x1="12" y1="8" x2="12" y2="16" stroke="currentColor" stroke-width="1.4" />
    {:else if visual.glyph === "upArrow"}
      <polyline points="8,13 12,9 16,13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      <line x1="12" y1="9" x2="12" y2="16" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    {:else if visual.glyph === "tick"}
      <polyline points="8,12 11,15 16,9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    {:else if visual.glyph === "cross"}
      <line x1="8" y1="8" x2="16" y2="16" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      <line x1="16" y1="8" x2="8" y2="16" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    {:else if visual.glyph !== "none"}
      <text x="12" y="15.5" text-anchor="middle" font-size="9" font-weight="700" fill="currentColor">{visual.glyph}</text>
    {/if}
  </g>
</svg>

<style>
  .ink-dark {
    color: #1b2430;
  }
  .ink-white {
    color: #ffffff;
  }
</style>
