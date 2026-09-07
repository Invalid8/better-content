<script setup lang="ts">
import type { CmsEngine } from "better-content/core";
import { useCmsSnapshot, vContentEdit } from "better-content/vue";

const props = defineProps<{ engine: CmsEngine; editing: boolean }>();
const snapshot = useCmsSnapshot(props.engine);
</script>

<template>
  <article class="island" data-framework="vue">
    <header class="island__bar">
      <span class="island__dot"></span>
      <span class="island__name">Vue</span>
      <code class="island__hook">v-content-edit</code>
      <span class="island__state" :data-dirty="snapshot.hasUnsavedChanges || undefined">
        {{ snapshot.hasUnsavedChanges ? "unsaved" : "synced" }}
      </span>
    </header>
    <div class="island__body">
      <p class="island__path">page / shared.message</p>
      <p
        class="island__text"
        v-content-edit="{
          engine,
          collection: 'page',
          itemId: 'shared',
          fieldKey: 'message',
          editing,
        }"
      ></p>
    </div>
  </article>
</template>
