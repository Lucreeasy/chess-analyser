<script lang="ts">
  import { route } from "../lib/router.svelte.ts";
  import Icon from "./Icon.svelte";

  const tabs = [
    { path: "/games", label: "Games", icon: "games" as const },
    { path: "/insights", label: "Insights", icon: "insights" as const },
    { path: "/puzzles", label: "Puzzles", icon: "puzzles" as const },
    { path: "/settings", label: "Settings", icon: "settings" as const },
  ];

  /** The Games screen is also the start page "/". */
  const isActive = (path: string) => (route.path === "/" ? path === "/games" : route.path.startsWith(path));
</script>

<nav class="top" aria-label="Main">
  <div class="top-inner">
    {#each tabs as tab (tab.path)}
      <a href={`#${tab.path}`} class="top-link" aria-current={isActive(tab.path) ? "page" : undefined}>{tab.label}</a>
    {/each}
    <a href="#/import" class="import-button"><Icon name="import" size={18} />Import</a>
  </div>
</nav>

<nav class="bottom" aria-label="Main">
  {#each tabs as tab (tab.path)}
    <a href={`#${tab.path}`} class="bottom-link" aria-current={isActive(tab.path) ? "page" : undefined}>
      <Icon name={tab.icon} size={22} />
      <span>{tab.label}</span>
    </a>
  {/each}
</nav>

<style>
  .top {
    display: none;
  }
  .bottom {
    position: fixed;
    inset-inline: 0;
    bottom: 0;
    display: flex;
    background: var(--surface);
    border-top: 1px solid var(--line);
    padding-bottom: env(safe-area-inset-bottom);
    z-index: 20;
  }
  .bottom-link {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    min-height: 56px;
    color: var(--muted);
    text-decoration: none;
    font-size: 12px;
    font-weight: 500;
  }
  .bottom-link[aria-current="page"] {
    color: var(--brand);
  }

  @media (min-width: 768px) {
    .bottom {
      display: none;
    }
    .top {
      display: block;
      background: var(--surface);
      border-bottom: 1px solid var(--line);
    }
    .top-inner {
      display: flex;
      align-items: center;
      gap: 4px;
      max-width: 1280px;
      margin: 0 auto;
      padding: 6px 16px;
    }
    .top-link {
      min-height: 44px;
      display: inline-flex;
      align-items: center;
      padding: 0 12px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      color: var(--muted);
      text-decoration: none;
    }
    .top-link:hover {
      background: var(--surface-2);
      color: var(--ink);
    }
    .top-link[aria-current="page"] {
      background: var(--surface-2);
      color: var(--brand);
    }
    .import-button {
      margin-left: auto;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-height: 44px;
      padding: 0 16px;
      border-radius: 12px;
      background: var(--brand);
      color: var(--brand-ink);
      text-decoration: none;
      font-size: 15px;
      font-weight: 500;
    }
  }
</style>
