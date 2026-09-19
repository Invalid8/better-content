<script setup lang="ts">
import type { CmsEngine } from "better-content/core";
import { useMarkdownEditor } from "better-content/vue";
import { renderMarkdown } from "../../lib/markdown";

const props = defineProps<{ engine: CmsEngine; editing: boolean }>();

const ITEM_ID = "note-vue";

const md = useMarkdownEditor({
  initialValue:
    props.engine.getItem<{ body?: string }>("page", ITEM_ID)?.body ?? "",
  onSave: async (content) => {
    props.engine.editField("page", ITEM_ID, "body", content);
    await props.engine.saveItem("page", ITEM_ID);
  },
});
const { textareaRef } = md;
</script>

<template>
  <article class="island" data-framework="vue">
    <header class="island__bar">
      <span class="island__dot"></span>
      <span class="island__name">Vue</span>
      <code class="island__hook">useMarkdownEditor()</code>
      <span class="island__state">{{ md.charCount.value }} chars</span>
    </header>
    <div class="island__body">
      <p class="island__path">page / {{ ITEM_ID }}.body</p>
      <template v-if="editing">
        <div class="draft__tools">
          <button type="button" @click="md.insert('**', '**', 'bold')">bold</button>
          <button type="button" @click="md.insert('[', '](https://)', 'link')">
            link
          </button>
          <button type="button" @click="md.insert('`', '`', 'code')">code</button>
        </div>
        <textarea
          ref="textareaRef"
          class="draft__area"
          rows="7"
          spellcheck="false"
          :value="md.value.value"
          @input="md.setValue(($event.target as HTMLTextAreaElement).value)"
        ></textarea>
        <div class="draft__actions">
          <button type="button" class="draft__button" @click="md.reset()">
            Reset
          </button>
          <button
            type="button"
            class="draft__button draft__button--mark"
            @click="md.save()"
          >
            Save draft
          </button>
        </div>
      </template>
      <div v-else class="draft__rendered" v-html="renderMarkdown(md.value.value)"></div>
    </div>
  </article>
</template>
