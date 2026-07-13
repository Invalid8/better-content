import type { ItemMap } from "better-content/core";

export const DEMO_ITEMS: ItemMap = {
  sections: [
    {
      id: "hero",
      heading: "Edit this page. It's a database.",
      tagline:
        "Turn on Edit and click any text you see. Save, reload, it's still here. Every field on this page is a row in a real Postgres, compiled to WebAssembly, persisted in your browser.",
      cover: "",
      order: 0,
    },
  ],
  cards: [
    {
      id: "own-your-data",
      title: "Own your data",
      body:
        "Content lives in your database, queried through a 7-method adapter. Here that database is PGlite in your tab; in production it's your Postgres or Firestore.",
      order: 0,
    },
    {
      id: "framework-neutral",
      title: "One engine, any framework",
      body:
        "The engine is a plain external store: getSnapshot and subscribe. React binds to it in ~40 lines; Vue and Svelte can too. Nothing in core imports a framework.",
      order: 1,
    },
    {
      id: "named-seams",
      title: "Every seam has a name",
      body:
        "Transport, DataAdapter, StorageAdapter, AuthAdapter. This demo skips HTTP entirely: the engine talks straight to the database through adapterTransport.",
      order: 2,
    },
  ],
};

export const CONTENT_CACHE_KEY = "better-content-demo-items";

export function readCachedItems(): ItemMap | null {
  try {
    const raw = localStorage.getItem(CONTENT_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    return parsed as ItemMap;
  } catch {
    return null;
  }
}

export function writeCachedItems(items: ItemMap): void {
  try {
    localStorage.setItem(CONTENT_CACHE_KEY, JSON.stringify(items));
  } catch {
    // Cache is only a startup optimization; editing still persists to PGlite.
  }
}
