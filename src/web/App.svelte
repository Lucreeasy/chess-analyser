<script lang="ts">
  interface Game {
    id: string;
    white: string;
    black: string;
    result: string;
  }

  let games: Game[] = [];
  let error: string | null = null;

  async function load() {
    try {
      const res = await fetch("api/games");
      if (!res.ok) throw new Error(`server answered ${res.status}`);
      games = await res.json();
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }

  load();
</script>

<h1>Games</h1>

{#if error}
  <p role="alert">Could not load games: {error}</p>
{:else if games.length === 0}
  <p>No games yet.</p>
{:else}
  <ul>
    {#each games as game (game.id)}
      <li>{game.white} vs {game.black} — {game.result}</li>
    {/each}
  </ul>
{/if}
