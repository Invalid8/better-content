<script lang="ts">
  import type { CmsEngine } from "better-content/core";
  import { contentEdit, engineStore } from "better-content/svelte";

  export let engine: CmsEngine;
  export let editing: boolean;

  const snapshot = engineStore(engine);
</script>

<article class="island" data-framework="svelte">
  <header class="island__bar">
    <span class="island__dot"></span>
    <span class="island__name">Svelte</span>
    <code class="island__hook">use:contentEdit</code>
    <span class="island__state" data-dirty={$snapshot.hasUnsavedChanges || undefined}>
      {$snapshot.hasUnsavedChanges ? "unsaved" : "synced"}
    </span>
  </header>
  <div class="island__body">
    <p class="island__path">page / shared.message</p>
    <p
      class="island__text"
      use:contentEdit={{
        engine,
        collection: "page",
        itemId: "shared",
        fieldKey: "message",
        editing,
      }}
    ></p>
  </div>
</article>
