<script lang="ts">
  import Badge from "./Badge.svelte";

  let { status }: { status: "none" | "queued" | "running" | "done" | "error" } = $props();

  const text: Record<typeof status, string> = {
    none: "Not analysed",
    queued: "Queued",
    running: "Analysing",
    done: "Analysed",
    error: "Failed",
  };
  const tone: Record<typeof status, "ok" | "danger" | "brand" | "muted"> = {
    none: "muted",
    queued: "muted",
    running: "brand",
    done: "ok",
    error: "danger",
  };
  const mark: Record<typeof status, string> = { none: "○", queued: "◐", running: "◐", done: "●", error: "▲" };
</script>

<Badge tone={tone[status]} mark={mark[status]} label={text[status]} />
