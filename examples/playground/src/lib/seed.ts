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
