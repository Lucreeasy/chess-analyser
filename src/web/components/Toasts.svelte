<script lang="ts">
  import { toasts, dismissToast } from "../lib/toasts.svelte.ts";
  import Icon from "./Icon.svelte";
</script>

<div class="toasts">
  {#each toasts as toast (toast.id)}
    <div class="toast tone-{toast.kind}" role={toast.kind === "error" ? "alert" : "status"}>
      <Icon name={toast.kind === "error" ? "alert" : "check"} size={18} />
      <p>{toast.message}</p>
      <button type="button" class="dismiss" onclick={() => dismissToast(toast.id)} aria-label="Dismiss message">
        <Icon name="close" size={16} />
      </button>
    </div>
  {/each}
</div>

<style>
  .toasts {
    position: fixed;
    top: 12px;
    left: 50%;
    transform: translateX(-50%);
    width: min(448px, calc(100vw - 24px));
    display: flex;
    flex-direction: column;
    gap: 8px;
    z-index: 50;
  }
  .toast {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 12px;
    font-size: 14px;
    box-shadow: 0 10px 15px rgba(0, 0, 0, 0.1);
  }
  .toast.tone-error {
    border-color: var(--danger);
  }
  .toast.tone-success :global(svg) {
    color: var(--ok);
  }
  .toast.tone-error :global(svg:first-child) {
    color: var(--danger);
  }
  .toast p {
    flex: 1;
  }
  .dismiss {
    width: 44px;
    height: 44px;
    margin: -12px -12px -12px 0;
    border: none;
    background: none;
    color: var(--muted);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    flex: none;
  }
</style>
