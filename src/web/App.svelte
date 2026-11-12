<script lang="ts">
  import { route } from "./lib/router.svelte.ts";
  import Nav from "./components/Nav.svelte";
  import QueueStrip from "./components/QueueStrip.svelte";
  import Toasts from "./components/Toasts.svelte";
  import GamesScreen from "./screens/GamesScreen.svelte";
  import ImportScreen from "./screens/ImportScreen.svelte";
  import ReviewScreen from "./screens/ReviewScreen.svelte";
  import InsightsScreen from "./screens/InsightsScreen.svelte";
  import PuzzlesScreen from "./screens/PuzzlesScreen.svelte";
  import SettingsScreen from "./screens/SettingsScreen.svelte";

  // The game id (URL-encoded) plus an optional ply, out-of-range clamped by the screen itself.
  const reviewMatch = $derived(route.path.match(/^\/games\/([^/]+)(?:\/(\d+))?$/));
</script>

<Toasts />
{#if !reviewMatch}
  <Nav />
  <QueueStrip />
{/if}

<main class:review={!!reviewMatch}>
  {#if reviewMatch}
    <ReviewScreen gameId={decodeURIComponent(reviewMatch[1]!)} ply={reviewMatch[2] ? Number(reviewMatch[2]) : 0} />
  {:else if route.path.startsWith("/insights")}
    <InsightsScreen />
  {:else if route.path.startsWith("/puzzles")}
    <PuzzlesScreen />
  {:else if route.path === "/settings"}
    <SettingsScreen />
  {:else if route.path.startsWith("/import")}
    <ImportScreen />
  {:else}
    <GamesScreen /><!-- "/", "/games" and any unknown address -->
  {/if}
</main>

<style>
  main {
    padding-bottom: 96px; /* phone bottom tab bar */
  }
  main.review {
    padding-bottom: 0;
  }
  @media (min-width: 768px) {
    main {
      padding-bottom: 0;
    }
  }
</style>
