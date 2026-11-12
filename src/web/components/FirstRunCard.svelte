<script lang="ts">
  /**
   * The first-run guide, shown while no username is saved, so step 1 is always the current one. On Settings
   * its link to Settings is left out.
   */
  let { onSettings = false }: { onSettings?: boolean } = $props();
</script>

<section class="card first-run">
  <h2>Welcome to Chess analyser</h2>
  <p class="muted">Two quick steps to your first game review.</p>
  <ol>
    <li aria-current="step">
      <span class="marker current" aria-hidden="true">1</span>
      <span>
        <strong>Add your chess.com username</strong>
        <span class="text">It tells Chess analyser which side is you in every game.</span>
        {#if !onSettings}<a class="primary small" href="#/settings">Open settings</a>{/if}
      </span>
    </li>
    <li>
      <span class="marker" aria-hidden="true">2</span>
      <span>
        <strong>Import your games</strong>
        <span class="text">Upload a PGN file, paste PGN text, or fetch by username.</span>
      </span>
    </li>
  </ol>
</section>

<style>
  .first-run {
    margin-top: 16px;
  }
  ol {
    display: grid;
    gap: 16px;
    margin: 16px 0 0;
    padding: 0;
    list-style: none;
  }
  li {
    display: flex;
    gap: 12px;
  }
  li > span:last-child {
    display: grid;
    justify-items: start;
    gap: 2px;
  }
  .marker {
    display: grid;
    place-items: center;
    flex: none;
    width: 28px;
    height: 28px;
    border: 2px solid var(--line);
    border-radius: 999px;
    color: var(--muted);
    font-size: 14px;
    font-weight: 600;
  }
  .marker.current {
    border-color: var(--brand);
    color: var(--brand);
  }
  .text {
    color: var(--muted);
    font-size: 14px;
  }
  .primary {
    margin-top: 8px;
  }
</style>
