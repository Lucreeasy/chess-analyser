<script lang="ts">
  import Icon from "./Icon.svelte";
  import { queue } from "../lib/live.svelte.ts";
  import { queueVisible, queueLabel, progressPercent } from "../lib/queueStatus.ts";
  import { apiPost, ApiError } from "../lib/api.ts";
  import { showToast } from "../lib/toasts.svelte.ts";

  let busy = $state(false);

  const visible = $derived(queueVisible(queue.status));

  async function toggle(): Promise<void> {
    if (!queue.status) return;
    busy = true;
    try {
      await apiPost(queue.status.paused ? "analyse/resume" : "analyse/pause");
    } catch (e) {
      showToast(`Could not change the queue: ${e instanceof ApiError ? e.message : "unexpected error"}`, "error");
    } finally {
      busy = false;
    }
  }
</script>

{#if visible && queue.status}
  <div class="strip" role="status">
    <div class="inner">
      <div class="info">
        <p class="label">{queueLabel(queue.status)}</p>
        <div class="bar">
          <div
            class="fill"
            class:paused={queue.status.paused}
            style={`width: ${queue.status.paused ? 100 : progressPercent(queue.status)}%`}
          ></div>
        </div>
      </div>
      <button type="button" onclick={toggle} disabled={busy}>
        <Icon name={queue.status.paused ? "play" : "pause"} size={16} />
        {queue.status.paused ? "Resume" : "Pause"}
      </button>
    </div>
  </div>
{/if}

<style>
  .strip {
    position: sticky;
    top: 0;
    z-index: 15;
    background: var(--surface);
    border-bottom: 1px solid var(--line);
    padding-top: env(safe-area-inset-top);
  }
  .inner {
    max-width: 1280px;
    margin: 0 auto;
    padding: 4px 16px;
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .info {
    flex: 1;
    min-width: 0;
  }
  .label {
    margin: 0;
    font-size: 14px;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .bar {
    margin-top: 2px;
    height: 6px;
    border-radius: 3px;
    background: var(--surface-2);
    overflow: hidden;
  }
  .fill {
    height: 100%;
    background: var(--brand);
  }
  .fill.paused {
    background: var(--muted);
    opacity: 0.4;
  }
  button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 44px;
    padding: 0 12px;
    border: 1px solid var(--line);
    border-radius: 10px;
    background: var(--surface);
    color: var(--ink);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    flex-shrink: 0;
  }
  button:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
</style>
