<script lang="ts">
  import Icon from "./Icon.svelte";
  import { summaryLine, queuedLine, monthLabel, monthMessage, failedHeading, type ImportReport } from "../lib/importReport.ts";

  let { report }: { report: ImportReport } = $props();

  const ok = $derived(report.failed.length === 0);
  const queued = $derived(queuedLine(report.queued));
</script>

<div class="report-card" role={ok ? "status" : "alert"}>
  <h2><Icon name={ok ? "check" : "alert"} size={20} />{report.title}</h2>
  <p class="summary">{summaryLine(report.added, report.duplicates, report.failed.length)}</p>
  {#if queued}
    <p class="muted">{queued}</p>
  {/if}

  {#if report.months}
    <ul class="months">
      {#each report.months as m (m.month)}
        <li>
          <span class="month">{m.month}</span>
          <span class="status" class:warn={m.status !== "ok"}>{monthLabel(m.status)}</span>
          <span class="muted">{monthMessage(m)}</span>
        </li>
      {/each}
    </ul>
  {/if}

  {#if report.failed.length > 0}
    <details>
      <summary>{failedHeading(report.failed.length)}</summary>
      <ul class="failures">
        {#each report.failed as f (f.index)}
          <li>
            <p>Game {f.index + 1}: {f.reason}</p>
            <pre>{f.snippet}</pre>
          </li>
        {/each}
      </ul>
    </details>
  {/if}

  <a class="view-games" href="#/games">View games</a>
</div>

<style>
  .report-card {
    border: 1px solid var(--line);
    border-radius: 16px;
    padding: 16px;
    background: var(--surface);
    margin-top: 16px;
  }
  h2 {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 16px;
    margin: 0;
  }
  .summary {
    font-size: 18px;
    margin: 8px 0 0;
  }
  .muted {
    color: var(--muted);
    font-size: 14px;
    margin: 4px 0 0;
  }
  .months {
    list-style: none;
    margin: 12px 0 0;
    padding: 0;
    border: 1px solid var(--line);
    border-radius: 12px;
    overflow: hidden;
  }
  .months li {
    display: grid;
    grid-template-columns: auto auto 1fr;
    gap: 8px;
    align-items: baseline;
    padding: 8px 12px;
    border-top: 1px solid var(--line);
    font-size: 14px;
  }
  .months li:first-child {
    border-top: none;
  }
  .status.warn {
    color: var(--danger);
  }
  details {
    margin-top: 12px;
  }
  summary {
    cursor: pointer;
    min-height: 44px;
    display: flex;
    align-items: center;
    color: var(--brand);
  }
  .failures {
    list-style: none;
    margin: 8px 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .failures p {
    margin: 0 0 4px;
    font-size: 14px;
  }
  .failures pre {
    margin: 0;
    font-size: 12px;
    color: var(--muted);
    white-space: pre-wrap;
    word-break: break-word;
  }
  .view-games {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    padding: 0 16px;
    margin-top: 16px;
    border-radius: 12px;
    background: var(--brand);
    color: var(--brand-ink);
    text-decoration: none;
    font-size: 15px;
    font-weight: 600;
  }
</style>
