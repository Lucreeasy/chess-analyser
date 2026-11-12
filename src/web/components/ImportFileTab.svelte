<script lang="ts">
  import Icon from "./Icon.svelte";
  import ImportReportCard from "./ImportReportCard.svelte";
  import { apiPostText, ApiError } from "../lib/api.ts";
  import { summaryLine, type ImportApiResult, type ImportReport } from "../lib/importReport.ts";

  type FileStatus = "waiting" | "importing" | "done" | "failed";
  interface FileEntry {
    name: string;
    status: FileStatus;
    result?: ImportApiResult;
    error?: string;
  }

  let chosen: File[] = $state([]);
  let files: FileEntry[] = $state([]);
  let importing = $state(false);
  let report: ImportReport | undefined = $state(undefined);

  function onChoose(e: Event): void {
    chosen = Array.from((e.currentTarget as HTMLInputElement).files ?? []);
    files = chosen.map((f) => ({ name: f.name, status: "waiting" }));
    report = undefined;
  }

  async function run(): Promise<void> {
    importing = true;
    for (let i = 0; i < chosen.length; i++) {
      files[i] = { ...files[i]!, status: "importing" };
      files = [...files];
      try {
        const text = await chosen[i]!.text();
        const result = await apiPostText<ImportApiResult>("games/import", text);
        files[i] = { ...files[i]!, status: "done", result };
      } catch (e) {
        files[i] = { ...files[i]!, status: "failed", error: e instanceof ApiError ? e.message : "unexpected error" };
      }
      files = [...files];
    }
    importing = false;

    const succeeded = files.filter((f): f is FileEntry & { result: ImportApiResult } => f.status === "done" && f.result !== undefined);
    if (succeeded.length > 0) {
      const failed = succeeded.flatMap((f) => f.result.failed);
      report = {
        title: chosen.length > 1 ? `Import finished: ${succeeded.length} of ${chosen.length} files` : "Import finished",
        added: succeeded.reduce((s, f) => s + f.result.added, 0),
        duplicates: succeeded.reduce((s, f) => s + f.result.duplicates, 0),
        failed,
        failedCount: failed.length,
        queued: succeeded.reduce((s, f) => s + f.result.queued, 0),
      };
    }
  }

  const buttonLabel = $derived(chosen.length > 1 ? `Import ${chosen.length} files` : "Import file");
</script>

<div>
  <label for="pgn-files">PGN files</label>
  <input id="pgn-files" type="file" accept=".pgn,text/plain" multiple disabled={importing} onchange={onChoose} />
  <p class="muted">Choose one or more files from chess.com's archive download. Each file is a separate upload.</p>

  <button type="button" class="primary" class:spinning={importing} disabled={chosen.length === 0 || importing} onclick={run}>
    {#if importing}<Icon name="sync" size={16} />Importing…{:else}{buttonLabel}{/if}
  </button>

  {#if files.length > 0}
    <div role="group" aria-label="Files">
      <ul class="file-list">
        {#each files as f, i (i)}
          <li>
            <span class="name">{f.name}</span>
            <span class="muted">
              {#if f.status === "waiting"}Waiting
              {:else if f.status === "importing"}Importing…
              {:else if f.status === "done" && f.result}{summaryLine(f.result.added, f.result.duplicates, f.result.failed.length)}
              {:else}Failed: {f.error}
              {/if}
            </span>
          </li>
        {/each}
      </ul>
    </div>
  {/if}

  {#if report}
    <ImportReportCard {report} />
  {/if}
</div>

<style>
  input[type="file"] {
    display: block;
    min-height: 44px;
    margin-top: 8px;
  }
  .file-list {
    list-style: none;
    margin: 16px 0 0;
    padding: 0;
    border: 1px solid var(--line);
    border-radius: 12px;
    overflow: hidden;
  }
  .file-list li {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 12px;
    border-top: 1px solid var(--line);
    font-size: 14px;
  }
  .file-list li:first-child {
    border-top: none;
  }
  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
