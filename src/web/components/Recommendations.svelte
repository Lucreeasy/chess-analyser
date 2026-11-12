<script lang="ts">
  import type { computeInsights } from "../../server/insights/insights.ts";
  import { drillLink } from "../lib/insightsLinks.ts";
  import Badge from "./Badge.svelte";
  import Icon from "./Icon.svelte";

  type Card = Extract<ReturnType<typeof computeInsights>, { ready: true }>["recommendations"][number];

  let { recommendations }: { recommendations: Card[] } = $props();

  const top = $derived(Math.max(...recommendations.map((r) => r.severity)));

  /** High (3 bars), Medium (2) or Low (1) by severity relative to the highest shown. */
  function priority(severity: number): { level: 1 | 2 | 3; text: string } {
    const r = severity / top;
    return r >= 0.75 ? { level: 3, text: "High priority" } : r >= 0.4 ? { level: 2, text: "Medium priority" } : { level: 1, text: "Low priority" };
  }

  /** "move 23" for a White ply, "move 23…" for a Black ply. */
  const moveText = (ply: number) => `move ${Math.ceil(ply / 2)}${ply % 2 === 0 ? "…" : ""}`;

  function practiceHref(practice: NonNullable<Card["practice"]>): string {
    const params = new URLSearchParams();
    if (practice.tag) params.set("tag", practice.tag);
    if (practice.phase) params.set("phase", practice.phase);
    return `#/puzzles${params.size ? `?${params}` : ""}`;
  }

  /** "Review these games": exactly the distinct evidence games, labelled with the card title. */
  function reviewHref(card: Card): string {
    const ids = [...new Set(card.evidence.map((e) => e.gameId))];
    return drillLink({ ids, total: ids.length }, card.title, {})!.href;
  }
</script>

{#if recommendations.length === 0}
  <p class="inset">No recommendations — nothing stands out. Keep playing; this list fills up when a pattern shows in your games.</p>
{:else}
  <div class="cards">
    {#each recommendations as card, i (card.id)}
      {@const p = priority(card.severity)}
      <article>
        <p class="badges">
          <Badge label="#{i + 1}" />
          <Badge label={p.text}>
            <svg class="severity-{p.level}" width="16" height="14" viewBox="0 0 16 14" aria-hidden="true">
              {#each [1, 2, 3] as bar (bar)}
                <rect x={(bar - 1) * 5.5 + 0.5} y={13.5 - bar * 4} width="4" height={bar * 4} rx="1" class:filled={bar <= p.level} />
              {/each}
            </svg>
          </Badge>
        </p>
        <h3>{card.title}</h3>
        <p class="finding">{card.finding}</p>
        <dl>
          <dt>Why it matters</dt>
          <dd>{card.why}</dd>
          <dt>What to do</dt>
          <dd>{card.action}</dd>
        </dl>
        <p class="label">Evidence</p>
        <ul class="evidence">
          {#each card.evidence as e (`${e.gameId}:${e.ply}`)}
            <li>
              <a class="neutral small" href={`#/games/${encodeURIComponent(e.gameId)}/${e.ply}`}>
                {e.opponent ? `vs ${e.opponent}` : `Game ${e.index}`}, {moveText(e.ply)}
              </a>
            </li>
          {/each}
        </ul>
        {#if card.practice}
          <a class="primary" href={practiceHref(card.practice)} aria-label={`Practise this: ${card.practice.label}`}>
            Practise this <Icon name="chevronRight" size={18} />
          </a>
        {:else}
          <a class="primary" href={reviewHref(card)}>Review these games <Icon name="chevronRight" size={18} /></a>
        {/if}
      </article>
    {/each}
  </div>
{/if}

<style>
  .cards {
    display: grid;
    gap: 12px;
    margin-top: 12px;
  }
  @media (min-width: 1024px) {
    .cards {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
  article {
    padding: 16px;
    border: 1px solid var(--line);
    border-radius: 12px;
    background: var(--surface);
  }
  .badges {
    display: flex;
    gap: 8px;
  }
  rect {
    fill: none;
    stroke: currentColor;
  }
  rect.filled {
    fill: currentColor;
  }
  .severity-3 {
    color: var(--danger);
  }
  .severity-2 {
    color: var(--accent);
  }
  .severity-1 {
    color: var(--muted);
  }
  h3 {
    margin-top: 8px;
    font-size: 16px;
    font-weight: 600;
  }
  .finding {
    margin-top: 8px;
    font-size: 16px;
    font-weight: 500;
  }
  dl {
    margin: 8px 0 0;
    font-size: 14px;
  }
  dt,
  .label {
    margin-top: 8px;
    color: var(--muted);
    font-size: 14px;
    font-weight: 500;
  }
  dd {
    margin: 0;
  }
  .evidence {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 4px 0 0;
    padding: 0;
    list-style: none;
  }
  .small {
    margin-top: 0;
    font-weight: 400;
  }
  .inset {
    margin-top: 12px;
  }
</style>
