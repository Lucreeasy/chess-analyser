<script lang="ts">
  import Icon from "./Icon.svelte";
  import ImportReportCard from "./ImportReportCard.svelte";
  import { apiGet, apiPost, ApiError } from "../lib/api.ts";
  import { timeClassLabel } from "../lib/format.ts";
  import type { Settings } from "../../server/settings.ts";
  import { isValidMonth } from "../../server/chesscom/parsing.ts";
  import { defaultRange, monthsInRange } from "../../server/chesscom/monthRange.ts";
  import { ALL_TIME_CLASSES } from "../../server/import/timeClass.ts";
  import type { TimeClass } from "../lib/types.ts";
  import type { MonthReport, ImportReport } from "../lib/importReport.ts";

  const OFFERED_CLASSES = ALL_TIME_CLASSES.filter((c) => c !== "classical") as TimeClass[];

  let username = $state("");
  let usernameTouched = $state(false);

  let months: string[] | undefined = $state();
  let loadingMonths = $state(false);
  let monthsStatusLine: string | undefined = $state(undefined);
  let monthsErrorMessage: string | undefined = $state(undefined);

  let fromMonth = $state("");
  let toMonth = $state("");
  let selectedClasses: Set<TimeClass> = $state(new Set(["bullet", "blitz", "rapid"]));

  let fetching = $state(false);
  let fetchProgress: string | undefined = $state(undefined);
  let report: ImportReport | undefined = $state(undefined);
  let fetchError: string | undefined = $state(undefined);

  apiGet<Settings>("settings")
    .then((s) => {
      if (!usernameTouched && s.usernames.length > 0) {
        username = s.usernames[0]!;
        loadMonths();
      }
    })
    .catch(() => {});

  function onUsernameInput(value: string): void {
    usernameTouched = true;
    username = value;
  }

  async function loadMonths(): Promise<void> {
    loadingMonths = true;
    monthsStatusLine = undefined;
    monthsErrorMessage = undefined;
    months = undefined;
    try {
      const res = await apiGet<{ months: string[] }>(`chesscom/archives?username=${encodeURIComponent(username)}`);
      months = res.months;
      if (months.length === 0) {
        monthsStatusLine = "This player has no archived games.";
      } else {
        monthsStatusLine = `${months.length} months with games, ${months[0]} to ${months[months.length - 1]}.`;
        const range = defaultRange(months);
        if (range) {
          fromMonth = range.from;
          toMonth = range.to;
        }
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 400) {
        monthsErrorMessage = e.message;
      } else if (e instanceof ApiError && e.status === 404) {
        monthsErrorMessage = `chess.com has no player called "${username}". Check the spelling and try again.`;
      } else if (e instanceof ApiError && e.status === 429) {
        monthsErrorMessage = "chess.com is rate limiting us right now. Wait a minute and try again.";
      } else {
        monthsErrorMessage = `Could not load the archive list: ${e instanceof ApiError ? e.message : "unexpected error"}`;
      }
    } finally {
      loadingMonths = false;
    }
  }

  const rangeError = $derived.by(() => {
    if (months === undefined || months.length === 0) return undefined;
    if (!isValidMonth(fromMonth) || !isValidMonth(toMonth)) return "Enter both months as YYYY-MM.";
    if (fromMonth > toMonth) return '"From" must not be after "To".';
    const first = months[0]!;
    const last = months[months.length - 1]!;
    if (fromMonth < first || toMonth > last) return `Pick months between ${first} and ${last}.`;
    return undefined;
  });

  const fetchMonths: string[] = $derived(months && rangeError === undefined ? monthsInRange(months, fromMonth, toMonth) : []);

  const rangeHint = $derived(
    rangeError ?? (fetchMonths.length > 0 ? `${fetchMonths.length} month${fetchMonths.length === 1 ? "" : "s"} will be fetched, one at a time.` : undefined),
  );

  function toggleClass(c: TimeClass): void {
    const next = new Set(selectedClasses);
    if (next.has(c)) next.delete(c);
    else next.add(c);
    selectedClasses = next;
  }

  const classesError = $derived(selectedClasses.size === 0 ? "Choose at least one time class." : undefined);

  const canFetch = $derived(
    !loadingMonths && !fetching && (months?.length ?? 0) > 0 && rangeError === undefined && classesError === undefined,
  );

  async function run(): Promise<void> {
    fetching = true;
    fetchProgress = "Starting…";
    fetchError = undefined;
    report = undefined;
    try {
      const result = await apiPost<{ months: MonthReport[]; added: number; duplicates: number; failed: number; queued: number }>(
        "chesscom/import",
        { username, from: fromMonth, to: toMonth, timeClasses: [...selectedClasses] },
      );
      report = {
        title: "Import finished",
        added: result.added,
        duplicates: result.duplicates,
        failed: [],
        failedCount: result.failed,
        queued: result.queued,
        months: result.months,
      };
    } catch (e) {
      fetchError = e instanceof ApiError ? e.message : "unexpected error";
    } finally {
      fetching = false;
      fetchProgress = undefined;
    }
  }
</script>

<div>
  <label for="username-input">chess.com username</label>
  <div class="row">
    <input
      id="username-input"
      type="text"
      value={username}
      disabled={fetching}
      oninput={(e) => onUsernameInput(e.currentTarget.value)}
    />
    <button type="button" class="neutral" disabled={username.trim() === "" || loadingMonths || fetching} onclick={loadMonths}>Load months</button>
  </div>
  <p class="muted" aria-live="polite">
    {#if loadingMonths}Looking up archives…{:else if monthsStatusLine}{monthsStatusLine}{/if}
  </p>
  {#if monthsErrorMessage}
    <p class="error-text" role="alert">{monthsErrorMessage}</p>
  {/if}

  <div class="month-row">
    <div class="field">
      <label for="from-month">From month</label>
      <input id="from-month" type="month" bind:value={fromMonth} disabled={!months || months.length === 0 || fetching} />
    </div>
    <div class="field">
      <label for="to-month">To month</label>
      <input id="to-month" type="month" bind:value={toMonth} disabled={!months || months.length === 0 || fetching} />
    </div>
  </div>
  {#if rangeHint}
    <p class:error-text={rangeError !== undefined} class:muted={rangeError === undefined}>{rangeHint}</p>
  {/if}

  <fieldset>
    <legend>Time classes</legend>
    <div class="classes">
      {#each OFFERED_CLASSES as c (c)}
        <label class="checkbox">
          <input type="checkbox" checked={selectedClasses.has(c)} disabled={fetching} onchange={() => toggleClass(c)} />
          {timeClassLabel(c)}
        </label>
      {/each}
    </div>
  </fieldset>
  {#if classesError}
    <p class="error-text">{classesError}</p>
  {/if}

  <button type="button" class="primary" class:spinning={fetching} disabled={!canFetch} onclick={run}>
    {#if fetching}<Icon name="sync" size={16} />Fetching…{:else}Fetch games{/if}
  </button>

  {#if fetching}
    <p class="muted" aria-live="polite">{fetchProgress}</p>
  {/if}

  {#if fetchError}
    <div class="error-card" role="alert">
      <h2>Import failed: {fetchError}</h2>
    </div>
  {:else if report}
    <ImportReportCard {report} />
  {/if}
</div>

<style>
  .row {
    display: flex;
    gap: 8px;
    align-items: flex-start;
    margin-top: 8px;
  }
  .row input {
    flex: 1;
  }
  .month-row {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin-top: 16px;
  }
  .field label {
    margin-bottom: 6px;
  }
  input[type="text"],
  input[type="month"] {
    width: 100%;
    min-height: 44px;
    padding: 0 12px;
    border: 1px solid var(--line);
    border-radius: 12px;
    background: var(--surface);
    color: var(--ink);
    font-size: 16px;
  }
  @media (min-width: 768px) {
    .month-row {
      flex-direction: row;
    }
    .month-row .field {
      flex: 1;
    }
  }
  .error-text {
    color: var(--danger);
    font-size: 14px;
    margin: 8px 0 0;
  }
  fieldset {
    margin: 16px 0 0;
    padding: 0;
    border: none;
  }
  legend {
    font-size: 14px;
    font-weight: 600;
    padding: 0;
  }
  .classes {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
    margin-top: 8px;
  }
  @media (min-width: 768px) {
    .classes {
      grid-template-columns: repeat(4, 1fr);
    }
  }
  .checkbox {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    padding: 0 12px;
    border: 1px solid var(--line);
    border-radius: 12px;
    font-weight: 400;
  }
</style>
