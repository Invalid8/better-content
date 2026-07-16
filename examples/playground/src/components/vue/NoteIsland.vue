<script setup lang="ts">
import { onMounted, onUnmounted, shallowRef } from "vue";
import type { CmsEngine } from "better-content/core";
import { ready } from "../../lib/engine";
import { editMode } from "../../lib/editMode";
import NoteCard from "./NoteCard.vue";

const engine = shallowRef<CmsEngine | null>(null);
const editing = shallowRef(editMode.get());
let stop = () => {};

onMounted(async () => {
  stop = editMode.subscribe(() => (editing.value = editMode.get()));
  engine.value = await ready;
});
onUnmounted(() => stop());
</script>

<template>
  <NoteCard v-if="engine" :engine="engine" :editing="editing" />
  <p v-else class="island-loading">starting Vue island…</p>
</template>
