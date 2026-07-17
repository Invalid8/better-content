<script setup lang="ts">
import type { CmsEngine } from "better-content/core";
import { useCmsSnapshot, vContentEdit } from "better-content/vue";

const props = defineProps<{ engine: CmsEngine; editing: boolean }>();
const snapshot = useCmsSnapshot(props.engine);
</script>

<template>
  <article class="note-card" data-framework="vue">
    <header>
      <h3>Vue</h3>
      <code>v-content-edit</code>
    </header>
    <p
      class="note-text"
      v-content-edit="{
        engine,
        collection: 'page',
        itemId: 'shared',
        fieldKey: 'message',
        editing,
      }"
    ></p>
    <footer>
      unsaved changes:
      <strong>{{ snapshot.hasUnsavedChanges ? "yes" : "no" }}</strong>
    </footer>
  </article>
</template>
