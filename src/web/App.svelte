<script lang="ts">
  import { route } from "./lib/router.svelte.ts";
  import Nav from "./components/Nav.svelte";
  import Toasts from "./components/Toasts.svelte";
  import GamesScreen from "./screens/GamesScreen.svelte";
  import ComingSoonScreen from "./screens/ComingSoonScreen.svelte";
</script>

<Toasts />
<Nav />

<main>
  {#if route.path === "/" || route.path.startsWith("/games")}
    <GamesScreen />
  {:else if route.path === "/insights"}
    <ComingSoonScreen title="Insights" />
  {:else if route.path === "/puzzles"}
    <ComingSoonScreen title="Puzzles" />
  {:else if route.path === "/settings"}
    <ComingSoonScreen title="Settings" />
  {:else if route.path.startsWith("/import")}
    <ComingSoonScreen title="Import" />
  {:else}
    <ComingSoonScreen title="Not found" />
  {/if}
</main>

<style>
  main {
    padding-bottom: 96px; /* phone bottom tab bar */
  }
  @media (min-width: 768px) {
    main {
      padding-bottom: 0;
    }
  }
</style>
