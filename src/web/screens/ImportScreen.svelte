<script lang="ts">
  import { route, navigate } from "../lib/router.svelte.ts";
  import Logo from "../components/Logo.svelte";
  import Icon from "../components/Icon.svelte";
  import ImportFileTab from "../components/ImportFileTab.svelte";
  import ImportPasteTab from "../components/ImportPasteTab.svelte";
  import ImportUsernameTab from "../components/ImportUsernameTab.svelte";

  const TABS = [
    { id: "file", label: "File", icon: "file" },
    { id: "paste", label: "Paste", icon: "clipboard" },
    { id: "username", label: "Username", icon: "user" },
  ] as const;
  type TabId = (typeof TABS)[number]["id"];

  function tabFromPath(path: string): TabId {
    const segment = path.split("/")[2];
    return TABS.some((t) => t.id === segment) ? (segment as TabId) : "file";
  }

  const active = $derived(tabFromPath(route.path));

  function onKeydown(e: KeyboardEvent): void {
    const i = TABS.findIndex((t) => t.id === active);
    let next = i;
    if (e.key === "ArrowLeft") next = (i - 1 + TABS.length) % TABS.length;
    else if (e.key === "ArrowRight") next = (i + 1) % TABS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = TABS.length - 1;
    else return;
    e.preventDefault();
    const id = TABS[next]!.id;
    navigate(`/import/${id}`);
    document.getElementById(`import-tab-${id}`)?.focus();
  }
</script>

<div class="screen">
  <h1><Logo />Import games</h1>
  <p class="muted">New games are de-duplicated, and queued for analysis if auto-analyse is on.</p>

  <div role="tablist" aria-label="Import source" class="tabs" tabindex="-1" onkeydown={onKeydown}>
    {#each TABS as tab (tab.id)}
      <a
        id={`import-tab-${tab.id}`}
        role="tab"
        aria-selected={active === tab.id}
        tabindex={active === tab.id ? 0 : -1}
        href={`#/import/${tab.id}`}
        class="tab"
        class:active={active === tab.id}
      ><Icon name={tab.icon} size={18} />{tab.label}</a>
    {/each}
  </div>

  <div class="card">
    {#if active === "file"}
      <ImportFileTab />
    {:else if active === "paste"}
      <ImportPasteTab />
    {:else}
      <ImportUsernameTab />
    {/if}
  </div>
</div>

<style>
  .screen {
    max-width: 720px;
    margin: 0 auto;
    padding: 16px;
  }
  h1 {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 24px;
    margin: 0;
  }
  .muted {
    color: var(--muted);
    font-size: 14px;
    margin: 4px 0 0;
  }
  .tabs {
    display: flex;
    margin-top: 16px;
    border: 1px solid var(--line);
    border-radius: 12px;
    background: var(--surface);
    overflow: hidden;
  }
  .tab {
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: 44px;
    padding: 0 12px;
    color: var(--ink);
    text-decoration: none;
    font-size: 14px;
    border-right: 1px solid var(--line);
    border-bottom: 2px solid transparent;
  }
  .tab:last-child {
    border-right: none;
  }
  .tab.active {
    background: var(--surface-2);
    border-bottom-color: var(--brand);
    font-weight: 600;
  }
  .card {
    margin-top: 12px;
    border: 1px solid var(--line);
    border-radius: 16px;
    background: var(--surface);
    padding: 16px;
  }
</style>
