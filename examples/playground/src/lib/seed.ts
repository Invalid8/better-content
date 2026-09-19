import type { ItemMap } from "better-content/core";

export const seedItems: ItemMap = {
  page: [
    {
      id: "hero",
      headline: "Edit this page.",
      tagline: "Watch your database change.",
      intro:
        "better-content puts editing on the page itself, and writes every change to a database you own, through a seven-method adapter, from React, Vue or Svelte. The Postgres below is real, and it is running in this browser tab.",
      cover: "/images/content-playground-hero.png",
    },
    {
      id: "shared",
      message:
        "One engine holds this sentence. React, Vue and Svelte are three ways of looking at it. Edit it in any island, click away, and watch the other two follow.",
    },
    {
      id: "note-react",
      body: "**React** keeps this draft in `useMarkdownEditor`, not in the engine.\n\nSelect a word and press bold: the primitive wraps your selection and leaves the caret inside the wrap.",
    },
    {
      id: "note-vue",
      body: "**Vue** calls the same composable, `useMarkdownEditor`, and binds `textareaRef` to this element.\n\nOne framework-free controller, three bindings over it.",
    },
    {
      id: "note-svelte",
      body: "**Svelte** gets `markdownEdit`, a readable store with a `textarea` action.\n\nSave writes the string to the row. Until then it is only a draft.",
    },
  ],
  cards: [
    {
      id: "cards-are-rows",
      title: "Cards are rows",
      body: "This card is a row in the cards table. Its title and body are columns you are reading through the adapter.",
      order: 0,
    },
    {
      id: "ops-are-optimistic",
      title: "Ops are optimistic",
      body: "Create, reorder, and delete update the snapshot immediately and roll back if the adapter rejects the write.",
      order: 1,
    },
    {
      id: "order-is-an-integer",
      title: "Order is an integer",
      body: "Reordering patches each row with a new order value through the transport. No hidden magic.",
      order: 2,
    },
  ],
};
