<script lang="ts">
  import { ready } from "../../lib/engine";
  import { editModeStore } from "../../lib/editMode";
  import PreviewFrame from "./PreviewFrame.svelte";
</script>

{#await ready}
  <p class="island-loading">starting Svelte preview...</p>
{:then engine}
  <PreviewFrame {engine} editing={$editModeStore} />
{/await}
