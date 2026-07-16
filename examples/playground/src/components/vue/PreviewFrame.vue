<script setup lang="ts">
import { computed, ref } from "vue";
import type { CmsEngine, Item } from "better-content/core";
import { useCmsSnapshot, vContentEdit } from "better-content/vue";

const props = defineProps<{ engine: CmsEngine; editing: boolean }>();
const snapshot = useCmsSnapshot(props.engine);
const draggingId = ref<string | null>(null);

const cards = computed(() =>
  [...(snapshot.value.items.cards ?? [])].sort(
    (a, b) => ((a.order as number) ?? 0) - ((b.order as number) ?? 0),
  ),
);

const reorder = (sourceId: string, targetId: string) => {
  if (!sourceId || sourceId === targetId) return;
  const ids = cards.value.map((card: Item) => card.id);
  const from = ids.indexOf(sourceId);
  const to = ids.indexOf(targetId);
  if (from < 0 || to < 0) return;
  ids.splice(from, 1);
  ids.splice(to, 0, sourceId);
  void props.engine.reorderItems("cards", ids);
};

const add = () =>
  void props.engine.createItem("cards", {
    title: "New row",
    body: "I was just INSERTed. Click me in edit mode, then check the inspector.",
    order: cards.value.length,
  });
</script>

<template>
  <div class="hero-live">
    <div class="hero-copy">
      <h1
        class="hero-headline"
        v-content-edit="{
          engine,
          collection: 'page',
          itemId: 'hero',
          fieldKey: 'headline',
          editing,
        }"
      ></h1>
      <p
        class="hero-intro"
        v-content-edit="{
          engine,
          collection: 'page',
          itemId: 'hero',
          fieldKey: 'intro',
          editing,
        }"
      ></p>
    </div>

    <div class="cards-board">
      <div class="cards-grid">
        <article
          v-for="card in cards"
          :key="card.id"
          class="board-card"
          :data-dragging="draggingId === card.id || undefined"
          @dragover.prevent="
            editing && draggingId && draggingId !== card.id
              ? ($event.dataTransfer!.dropEffect = 'move')
              : null
          "
          @drop="
            editing
              ? (reorder(
                  $event.dataTransfer!.getData('text/plain') || draggingId || '',
                  card.id,
                ),
                (draggingId = null))
              : null
          "
        >
          <h3
            v-content-edit="{
              engine,
              collection: 'cards',
              itemId: card.id,
              fieldKey: 'title',
              editing,
            }"
          ></h3>
          <p
            v-content-edit="{
              engine,
              collection: 'cards',
              itemId: card.id,
              fieldKey: 'body',
              editing,
            }"
          ></p>
          <div v-if="editing" class="card-ops">
            <span
              class="drag-handle"
              draggable="true"
              aria-label="Drag to reorder"
              @dragstart="
                $event.dataTransfer!.effectAllowed = 'move';
                $event.dataTransfer!.setData('text/plain', card.id);
                draggingId = card.id;
              "
              @dragend="draggingId = null"
            >
              drag
            </span>
            <button
              class="remove"
              type="button"
              :aria-label="`Delete ${card.title}`"
              @click="void engine.deleteItem('cards', card.id)"
            >
              x delete
            </button>
          </div>
        </article>
        <button v-if="editing" class="add-card" type="button" @click="add">
          + INSERT a card
        </button>
      </div>
      <p v-if="!editing" class="board-hint">
        Toggle Edit in the preview header to insert, drag, and delete rows.
      </p>
    </div>
  </div>
</template>
