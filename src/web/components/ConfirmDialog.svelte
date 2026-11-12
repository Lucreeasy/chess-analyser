<script lang="ts">
  let {
    title,
    body,
    confirmLabel,
    busyLabel,
    busy = false,
    danger = false,
    onConfirm,
    onCancel,
  }: {
    title: string;
    body: string;
    confirmLabel: string;
    busyLabel: string;
    busy?: boolean;
    danger?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
  } = $props();

  let dialogEl: HTMLDialogElement;

  $effect(() => {
    dialogEl?.showModal();
  });

  function handleCancelEvent(e: Event): void {
    if (busy) e.preventDefault();
  }

  function handleBackdropClick(e: MouseEvent): void {
    if (!busy && e.target === dialogEl) onCancel();
  }
</script>

<dialog bind:this={dialogEl} aria-labelledby="confirm-dialog-title" onclose={onCancel} oncancel={handleCancelEvent} onclick={handleBackdropClick}>
  <h2 id="confirm-dialog-title">{title}</h2>
  <p>{body}</p>
  <div class="actions">
    <button type="button" onclick={onCancel} disabled={busy}>Cancel</button>
    <button type="button" class:danger onclick={onConfirm} disabled={busy}>
      {busy ? busyLabel : confirmLabel}
    </button>
  </div>
</dialog>

<style>
  dialog {
    border-radius: 16px;
    padding: 20px;
    width: min(448px, calc(100vw - 32px));
    max-height: calc(100vh - 32px);
    border: 1px solid var(--line);
    background: var(--surface);
    color: var(--ink);
  }
  dialog::backdrop {
    background: rgba(0, 0, 0, 0.5);
  }
  h2 {
    margin: 0 0 12px;
  }
  p {
    font-size: 14px;
    margin: 0;
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 20px;
  }
  .actions button {
    min-height: 44px;
    padding: 0 16px;
    border: 1px solid var(--line);
    border-radius: 12px;
    background: var(--surface);
    font-size: 15px;
    cursor: pointer;
  }
  .actions button:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
  .actions button.danger {
    border-color: var(--danger);
    background: var(--danger);
    color: var(--danger-ink);
  }
</style>
