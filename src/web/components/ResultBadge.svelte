<script lang="ts">
  import Badge from "./Badge.svelte";

  let { myResult, result }: { myResult: "win" | "loss" | "draw" | undefined; result: string } = $props();

  const label = $derived(myResult === "win" ? "Win" : myResult === "loss" ? "Loss" : myResult === "draw" ? "Draw" : result);
  const tone = $derived(myResult === "win" ? "ok" : myResult === "loss" ? "danger" : "muted");
  const mark = $derived(myResult === "win" ? "✓" : myResult === "loss" ? "✗" : myResult === "draw" ? "=" : "?");
</script>

<Badge {tone} {mark} {label} />
