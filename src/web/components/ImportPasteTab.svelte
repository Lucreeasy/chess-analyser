<script lang="ts">
  import Icon from "./Icon.svelte";
  import ImportReportCard from "./ImportReportCard.svelte";
  import { apiPostText, ApiError } from "../lib/api.ts";
  import type { ImportApiResult, ImportReport } from "../lib/importReport.ts";

  const PLACEHOLDER = `[Event "Live Chess"]
[White "you"]
[Black "opponent"]
…
1. e4 e5 2. Nf3 …`;

  let text = $state("");
  let importing = $state(false);
  let report: ImportReport | undefined = $state(undefined);
  let error: string | undefined = $state(undefined);

  async function run(): Promise<void> {
    importing = true;
    error = undefined;
    report = undefined;
    try {
      const result = await apiPostText<ImportApiResult>("games/import", text);
      report = {
        title: "Import finished",
        added: result.added,
        duplicates: result.duplicates,
        failed: result.failed,
        failedCount: result.failed.length,
        queued: result.queued,
      };
    } catch (e) {
      error = e instanceof ApiError ? e.message : "unexpected error";
    } finally {
      importing = false;
    }
  }
</script>

<div>
  <label for="pgn-text">PGN text</label>
  <textarea id="pgn-text" bind:value={text} disabled={importing} placeholder={PLACEHOLDER}></textarea>
  <p class="muted">One game or many, separated by blank lines.</p>

  <button type="button" class="primary" class:spinning={importing} disabled={text.trim() === "" || importing} onclick={run}>
    {#if importing}<Icon name="sync" size={16} />Importing…{:else}Import pasted games{/if}
  </button>

  {#if error}
    <div class="error-card" role="alert">
      <h2>Import failed: {error}</h2>
    </div>
  {:else if report}
    <ImportReportCard {report} />
  {/if}
</div>

<style>
  textarea {
    display: block;
    width: 100%;
    min-height: 200px;
    margin-top: 8px;
    padding: 10px 12px;
    border: 1px solid var(--line);
    border-radius: 12px;
    background: var(--surface);
    color: var(--ink);
    font-family: monospace;
    font-size: 13px;
    resize: vertical;
  }
</style>
