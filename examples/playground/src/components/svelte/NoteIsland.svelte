<script lang="ts">
  import { ready } from "../../lib/engine";
  import { editModeStore } from "../../lib/editMode";
  import NoteCard from "./NoteCard.svelte";
</script>

{#await ready}
  <p class="island-loading">starting Svelte island…</p>
{:then engine}
  <NoteCard {engine} editing={$editModeStore} />
{/await}
