<script lang="ts">
  import logoUrl from "../assets/logo.svg";

  let { size = 28 }: { size?: number } = $props();
</script>

<img src={logoUrl} alt="" width={size} height={size} />
