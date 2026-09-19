<script lang="ts">
  import type { CmsEngine } from "better-content/core";
  import { markdownEdit } from "better-content/svelte";
  import { renderMarkdown } from "../../lib/markdown";

  export let engine: CmsEngine;
  export let editing: boolean;

  const ITEM_ID = "note-svelte";

  const md = markdownEdit({
    initialValue: engine.getItem<{ body?: string }>("page", ITEM_ID)?.body ?? "",
    onSave: async (content) => {
      engine.editField("page", ITEM_ID, "body", content);
      await engine.saveItem("page", ITEM_ID);
    },
  });
  const { textarea } = md;
</script>

<article class="island" data-framework="svelte">
  <header class="island__bar">
    <span class="island__dot"></span>
    <span class="island__name">Svelte</span>
    <code class="island__hook">markdownEdit()</code>
    <span class="island__state">{$md.charCount} chars</span>
  </header>
  <div class="island__body">
    <p class="island__path">page / {ITEM_ID}.body</p>
    {#if editing}
      <div class="draft__tools">
        <button type="button" on:click={() => md.insert("**", "**", "bold")}>bold</button>
        <button type="button" on:click={() => md.insert("[", "](https://)", "link")}>
          link
        </button>
        <button type="button" on:click={() => md.insert("`", "`", "code")}>code</button>
      </div>
      <textarea
        use:textarea
        class="draft__area"
        rows="7"
        spellcheck="false"
        value={$md.value}
        on:input={(event) => md.setValue(event.currentTarget.value)}
      ></textarea>
      <div class="draft__actions">
        <button type="button" class="draft__button" on:click={() => md.reset()}>
          Reset
        </button>
        <button
          type="button"
          class="draft__button draft__button--mark"
          on:click={() => md.save()}
        >
          Save draft
        </button>
      </div>
    {:else}
      <div class="draft__rendered">{@html renderMarkdown($md.value)}</div>
    {/if}
  </div>
</article>
