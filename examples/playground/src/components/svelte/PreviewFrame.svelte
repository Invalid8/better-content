<script lang="ts">
  import type { CmsEngine, Item } from "better-content/core";
  import { contentEdit, engineStore } from "better-content/svelte";

  export let engine: CmsEngine;
  export let editing: boolean;

  const snapshot = engineStore(engine);
  let draggingId: string | null = null;

  $: cards = [...($snapshot.items.cards ?? [])].sort(
    (a: Item, b: Item) =>
      ((a.order as number) ?? 0) - ((b.order as number) ?? 0),
  );

  const reorder = (sourceId: string, targetId: string) => {
    if (!sourceId || sourceId === targetId) return;
    const ids = cards.map((card: Item) => card.id);
    const from = ids.indexOf(sourceId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    ids.splice(from, 1);
    ids.splice(to, 0, sourceId);
    void engine.reorderItems("cards", ids);
  };

  const add = () =>
    void engine.createItem("cards", {
      title: "New row",
      body: "I was just INSERTed. Click me in edit mode, then check the inspector.",
      order: cards.length,
    });
</script>

<div class="hero-live">
  <div class="hero-copy">
    <h1
      class="hero-headline"
      use:contentEdit={{
        engine,
        collection: "page",
        itemId: "hero",
        fieldKey: "headline",
        editing,
      }}
    ></h1>
    <p
      class="hero-intro"
      use:contentEdit={{
        engine,
        collection: "page",
        itemId: "hero",
        fieldKey: "intro",
        editing,
      }}
    ></p>
  </div>

  <div class="cards-board">
    <div class="cards-grid">
      {#each cards as card (card.id)}
        <article
          class="board-card"
          data-dragging={draggingId === card.id || undefined}
          on:dragover={(event) => {
            if (!editing || !draggingId || draggingId === card.id) return;
            event.preventDefault();
            event.dataTransfer!.dropEffect = "move";
          }}
          on:drop={(event) => {
            if (!editing) return;
            event.preventDefault();
            reorder(
              event.dataTransfer!.getData("text/plain") || draggingId || "",
              card.id,
            );
            draggingId = null;
          }}
        >
          <h3
            use:contentEdit={{
              engine,
              collection: "cards",
              itemId: card.id,
              fieldKey: "title",
              editing,
            }}
          ></h3>
          <p
            use:contentEdit={{
              engine,
              collection: "cards",
              itemId: card.id,
              fieldKey: "body",
              editing,
            }}
          ></p>
          {#if editing}
            <div class="card-ops">
              <span
                class="drag-handle"
                draggable="true"
                aria-label="Drag to reorder"
                on:dragstart={(event) => {
                  event.dataTransfer!.effectAllowed = "move";
                  event.dataTransfer!.setData("text/plain", card.id);
                  draggingId = card.id;
                }}
                on:dragend={() => (draggingId = null)}
              >
                drag
              </span>
              <button
                class="remove"
                type="button"
                aria-label={`Delete ${card.title}`}
                on:click={() => void engine.deleteItem("cards", card.id)}
              >
                x delete
              </button>
            </div>
          {/if}
        </article>
      {/each}
      {#if editing}
        <button class="add-card" type="button" on:click={add}>
          + INSERT a card
        </button>
      {/if}
    </div>
    {#if !editing}
      <p class="board-hint">
        Toggle Edit in the preview header to insert, drag, and delete rows.
      </p>
    {/if}
  </div>
</div>
