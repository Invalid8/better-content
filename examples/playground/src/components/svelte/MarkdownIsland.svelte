<script lang="ts">
  import { ready } from "../../lib/engine";
  import { editModeStore } from "../../lib/editMode";
  import MarkdownCard from "./MarkdownCard.svelte";
</script>

{#await ready}
  <p class="island-loading">starting Svelte...</p>
{:then engine}
  <MarkdownCard {engine} editing={$editModeStore} />
{/await}
