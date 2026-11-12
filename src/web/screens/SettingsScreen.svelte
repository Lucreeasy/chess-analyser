<script lang="ts">
  import { AUTO_SYNC_HOURS, MAX_USERNAMES, type Settings, type DepthPreset } from "../../server/settings.ts";
  import { DEPTH_LABEL, DEPTH_PRESETS, SEARCH_DEPTH } from "../../server/analysisQueue/depthPresets.ts";
  import { isValidUsername } from "../../server/chesscom/parsing.ts";
  import { apiGet, apiPost } from "../lib/api.ts";
  import { plural } from "../lib/format.ts";
  import { showToast } from "../lib/toasts.svelte.ts";
  import Logo from "../components/Logo.svelte";
  import Icon from "../components/Icon.svelte";
  import FirstRunCard from "../components/FirstRunCard.svelte";

  const DEPTH_TEXT: Record<DepthPreset, string> = {
    quick: "Fast scan for bulk analysis. May miss subtle mistakes.",
    standard: "Balanced default: good accuracy at a reasonable pace.",
    deep: "Slowest and most precise. Best for games that matter.",
  };
  const hoursLabel = (h: number) => (h === 0 ? "Off" : plural(h, "hour"));

  let settings: Settings | undefined = $state();
  let loadError: string | undefined = $state();
  apiGet<Settings>("settings").then(
    (s) => (settings = s),
    (e) => (loadError = e instanceof Error ? e.message : String(e)),
  );

  /** Saves at once: the screen changes first and goes back with a toast if the server refuses. */
  let saving = $state(false);
  async function save(patch: Partial<Settings>): Promise<void> {
    const before = settings!;
    settings = { ...before, ...patch };
    saving = true;
    try {
      settings = await apiPost<Settings>("settings", patch);
    } catch (e) {
      settings = before;
      showToast(`Could not save settings: ${e instanceof Error ? e.message : String(e)}`, "error");
    } finally {
      saving = false;
    }
  }

  let newName = $state("");
  let nameError: string | undefined = $state();
  function addUsername(event: SubmitEvent): void {
    event.preventDefault();
    const name = newName.trim();
    if (name === "") return;
    if (!isValidUsername(name)) nameError = `Use 3-25 letters, numbers, "-" or "_".`;
    else if (settings!.usernames.includes(name.toLowerCase())) nameError = `"${name}" is already in the list.`;
    else if (settings!.usernames.length >= MAX_USERNAMES) nameError = `At most ${MAX_USERNAMES} usernames can be saved.`;
    else {
      save({ usernames: [...settings!.usernames, name.toLowerCase()] });
      newName = "";
    }
  }
</script>

<div class="page settings">
  <h1 class="page-title"><Logo />Settings</h1>
  {#if loadError}
    <div class="error-card" role="alert"><p>Could not load settings: {loadError}</p></div>
  {:else if !settings}
    <p class="muted" role="status">Loading settings…</p>
  {:else}
    {#if settings.usernames.length === 0}<FirstRunCard onSettings />{/if}
    <section class="card">
      <h2>Your chess.com usernames</h2>
      <p class="muted">Decides which side is "you" in every game. Names are stored in lower case.</p>
      <form class="add" onsubmit={addUsername}>
        <label class="sr-only" for="new-username">Add a username</label>
        <input
          id="new-username"
          type="text"
          placeholder="chess.com username"
          autocapitalize="off"
          autocomplete="off"
          spellcheck="false"
          bind:value={newName}
          oninput={() => (nameError = undefined)}
          aria-invalid={!!nameError}
          aria-describedby={nameError ? "username-error" : undefined}
        />
        <button type="submit" class="primary" disabled={newName.trim() === "" || saving}>Add</button>
      </form>
      {#if nameError}<p class="error-text" id="username-error" role="alert">{nameError}</p>{/if}
      {#if settings.usernames.length === 0}
        <p class="muted">No username yet.</p>
      {:else}
        <ul class="pills" aria-label="Saved usernames">
          {#each settings.usernames as name (name)}
            <li>
              {name}
              <button type="button" aria-label={`Remove ${name}`} onclick={() => save({ usernames: settings!.usernames.filter((n) => n !== name) })}>
                <Icon name="close" size={16} />
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    </section>

    <section class="card">
      <h2>Analysis</h2>
      <fieldset>
        <legend>Default depth</legend>
        <div class="options">
          {#each DEPTH_PRESETS as d (d)}
            <label class="option" class:selected={settings.depthPreset === d}>
              <input type="radio" name="depth" checked={settings.depthPreset === d} onchange={() => save({ depthPreset: d })} />
              <span>
                <span class="option-name">{DEPTH_LABEL[d]} <span class="muted-inline">· depth {SEARCH_DEPTH[d]}</span></span>
                <span class="option-text">{DEPTH_TEXT[d]}</span>
              </span>
            </label>
          {/each}
        </div>
      </fieldset>
      <label class="switch-row">
        <span>
          <span class="option-name">Analyse new games automatically</span>
          <span class="option-text">Imported games are queued for analysis at the default depth.</span>
        </span>
        <input type="checkbox" role="switch" checked={settings.autoAnalyse} onchange={(e) => save({ autoAnalyse: e.currentTarget.checked })} />
      </label>
    </section>

    <section class="card">
      <h2>Auto-sync</h2>
      <p class="muted">
        {settings.autoSyncHours === 0
          ? "Automatic sync is off."
          : `Fetches new games for your usernames every ${plural(settings.autoSyncHours, "hour")}.`}
      </p>
      <label for="auto-sync" class="field-label">Check chess.com every</label>
      <select
        id="auto-sync"
        disabled={settings.usernames.length === 0}
        value={settings.autoSyncHours}
        onchange={(e) => save({ autoSyncHours: Number(e.currentTarget.value) })}
      >
        {#each AUTO_SYNC_HOURS as h (h)}<option value={h}>{hoursLabel(h)}</option>{/each}
      </select>
      {#if settings.usernames.length === 0}<p class="muted">Add a username first.</p>{/if}
    </section>
  {/if}
</div>

<style>
  .settings {
    max-width: 768px;
  }
  .card {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
    margin-top: 16px;
  }
  h2 {
    font-size: 18px;
    font-weight: 600;
  }
  .card > .muted {
    margin: 0;
  }
  .add {
    display: flex;
    gap: 8px;
  }
  .add input {
    flex: 1;
    min-width: 0;
  }
  .add input[aria-invalid="true"] {
    border-color: var(--danger);
  }
  .add .primary {
    margin-top: 0;
  }
  .pills {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .pills li {
    display: inline-flex;
    align-items: center;
    height: 44px;
    padding-left: 16px;
    border: 1px solid var(--line);
    border-radius: 999px;
    background: var(--surface-2);
    font-size: 16px;
    font-weight: 500;
  }
  .pills button {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border: none;
    border-radius: 999px;
    background: none;
    color: var(--muted);
    cursor: pointer;
  }
  .pills button:hover {
    color: var(--danger);
  }
  fieldset {
    margin: 0;
    padding: 0;
    border: none;
  }
  legend {
    margin-bottom: 8px;
    color: var(--muted);
    font-size: 14px;
    font-weight: 500;
  }
  /* Option cards: radio rows with a title and a description. */
  .options {
    display: grid;
    gap: 8px;
  }
  @media (min-width: 768px) {
    .options {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }
  .option {
    display: flex;
    gap: 12px;
    min-height: 44px;
    padding: 12px;
    border: 1px solid var(--line);
    border-radius: 12px;
    font-weight: 400;
    cursor: pointer;
  }
  .option.selected {
    border-color: var(--brand);
    background: color-mix(in srgb, var(--brand) 12%, var(--surface));
  }
  .option:focus-within {
    outline: 2px solid var(--brand);
    outline-offset: 2px;
  }
  .option input {
    width: 20px;
    height: 20px;
    margin: 0;
    accent-color: var(--brand);
    flex: none;
  }
  .option-name,
  .option-text {
    display: block;
  }
  .option-name {
    font-size: 16px;
    font-weight: 500;
  }
  .option-text {
    color: var(--muted);
    font-size: 14px;
  }
  .option-name .muted-inline {
    font-weight: 400;
  }
  /* The switch: the whole row is the click target. */
  .switch-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 44px;
    font-weight: 400;
    cursor: pointer;
  }
  .switch-row input {
    appearance: none;
    position: relative;
    flex: none;
    width: 48px;
    height: 28px;
    margin: 0;
    border: 1px solid var(--line);
    border-radius: 999px;
    background: var(--surface-2);
    cursor: pointer;
    transition: background 150ms;
  }
  .switch-row input::after {
    content: "";
    position: absolute;
    top: 2px;
    left: 2px;
    width: 22px;
    height: 22px;
    border-radius: 999px;
    background: var(--muted);
    transition: transform 150ms;
  }
  .switch-row input:checked {
    border-color: var(--brand);
    background: var(--brand);
  }
  .switch-row input:checked::after {
    background: var(--brand-ink);
    transform: translateX(20px);
  }
  .field-label {
    color: var(--muted);
    font-size: 14px;
    font-weight: 500;
  }
</style>
