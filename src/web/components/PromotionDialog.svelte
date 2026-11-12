<script lang="ts">
  /** The promotion picker, a small modal reusing the confirm dialog's shape. */
  import type { Color } from "@lichess-org/chessground/types";

  const PIECES = [
    { role: "queen", letter: "q", glyph: "♛" },
    { role: "rook", letter: "r", glyph: "♜" },
    { role: "bishop", letter: "b", glyph: "♝" },
    { role: "knight", letter: "n", glyph: "♞" },
  ] as const;

  let {
    colour,
    onChoose,
    onCancel,
  }: {
    /** The promoting side, so the piece glyphs are drawn in the right colour. */
    colour: Color;
    onChoose: (letter: "q" | "r" | "b" | "n") => void;
    onCancel: () => void;
  } = $props();

  let dialogEl: HTMLDialogElement;

  $effect(() => {
    dialogEl?.showModal();
  });

  function handleBackdropClick(e: MouseEvent): void {
    if (e.target === dialogEl) onCancel();
  }
</script>

<dialog bind:this={dialogEl} aria-labelledby="promotion-dialog-title" onclose={onCancel} onclick={handleBackdropClick}>
  <h2 id="promotion-dialog-title">Promote to</h2>
  <div class="pieces">
    {#each PIECES as piece (piece.role)}
      <button type="button" class="piece" class:black={colour === "black"} onclick={() => onChoose(piece.letter)}>
        <span class="glyph">{piece.glyph}</span>
        <span class="label">{piece.role[0]!.toUpperCase()}{piece.role.slice(1)}</span>
      </button>
    {/each}
  </div>
  <button type="button" class="cancel" onclick={onCancel}>Cancel</button>
</dialog>

<style>
  dialog {
    border-radius: 16px;
    padding: 20px;
    width: min(360px, calc(100vw - 32px));
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
  .pieces {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
  }
  .piece {
    min-height: 64px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    border: 1px solid var(--line);
    border-radius: 12px;
    background: var(--surface);
    color: var(--ink);
    cursor: pointer;
  }
  .piece:hover {
    background: var(--surface-2);
  }
  .piece.black {
    color: #1b1b1b;
  }
  .glyph {
    font-size: 30px;
    line-height: 1;
  }
  .label {
    font-size: 12px;
    color: var(--muted);
  }
  .cancel {
    width: 100%;
    min-height: 44px;
    margin-top: 12px;
    border: 1px solid var(--line);
    border-radius: 12px;
    background: var(--surface);
    color: var(--ink);
    cursor: pointer;
  }
</style>
