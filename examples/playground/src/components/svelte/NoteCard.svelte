<script lang="ts">
  import type { CmsEngine } from "better-content/core";
  import { contentEdit, engineStore } from "better-content/svelte";

  export let engine: CmsEngine;
  export let editing: boolean;

  const snapshot = engineStore(engine);
</script>

<article class="note-card" data-framework="svelte">
  <header>
    <h3>Svelte</h3>
    <code>use:contentEdit</code>
  </header>
  <p
    class="note-text"
    use:contentEdit={{
      engine,
      collection: "page",
      itemId: "shared",
      fieldKey: "message",
      editing,
    }}
  ></p>
  <footer>
    unsaved changes:
    <strong>{$snapshot.hasUnsavedChanges ? "yes" : "no"}</strong>
  </footer>
</article>
