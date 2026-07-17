import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { PostgresDataAdapter } from "better-content/adapters/postgres";
import type { DataAdapter, Item, ItemMap, Query } from "better-content/core";

export type AdapterId = "pglite" | "memory" | "rest";

export const adapterOptions: Array<{
  id: AdapterId;
  label: string;
  caption: string;
}> = [
  {
    id: "pglite",
    label: "PGlite Postgres",
    caption:
      "Real Postgres compiled to WebAssembly, persisted in IndexedDB. Survives reloads.",
  },
  {
    id: "memory",
    label: "In-memory Map",
    caption:
      "The same 7-method contract over a plain Map. Volatile, resets on reload.",
  },
  {
    id: "rest",
    label: "Mock REST client",
    caption:
      "A DataAdapter shaped like an HTTP SDK: adds latency and logs each call to the console.",
  },
];

// The playground schema: two tables, owned by the app, not by the library.
const page = pgTable("page", {
  id: text("id").primaryKey(),
  headline: text("headline"),
  intro: text("intro"),
  message: text("message"),
  cover: text("cover"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

const cards = pgTable("cards", {
  id: text("id").primaryKey(),
  title: text("title"),
  body: text("body"),
  order: integer("order"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

const schema = { page, cards };

const DDL = `
  CREATE TABLE IF NOT EXISTS page (
    id         text PRIMARY KEY,
    headline   text,
    intro      text,
    message    text,
    cover      text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS cards (
    id         text PRIMARY KEY,
    title      text,
    body       text,
    "order"    integer,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
  );
`;

export const seedItems: ItemMap = {
  page: [
    {
      id: "hero",
      headline: "This page is a database.",
      intro:
        "Every block of text you can read here is a row. Toggle Edit in the toolbar, click any highlighted text, change it, press Save, then swap adapters to see the same UI talk to another backend.",
      cover: "/images/content-playground-hero.png",
    },
    {
      id: "shared",
      message:
        "One engine holds this sentence. React, Vue, and Svelte are three ways of looking at it. Edit me in any island, click away, and watch the other two follow.",
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

const client = new PGlite("idb://better-content-playground");

const pgliteAdapter = new PostgresDataAdapter({
  db: drizzle(client, { schema }) as never,
  schema: schema as never,
});

function applyQuery(rows: Item[], query?: Query): Item[] {
  let next = [...rows];
  for (const order of query?.orderBy ?? []) {
    const direction = order.direction === "desc" ? -1 : 1;
    next.sort((a, b) => {
      const av = a[order.field];
      const bv = b[order.field];
      if (av === bv) return 0;
      return (av ?? "") > (bv ?? "") ? direction : -direction;
    });
  }
  if (query?.offset != null) next = next.slice(query.offset);
  if (query?.limit != null) next = next.slice(0, query.limit);
  return next;
}

class MapDataAdapter implements DataAdapter {
  protected data = new Map<string, Map<string, Item>>();

  constructor(seed: ItemMap = seedItems) {
    this.replace(seed);
  }

  replace(seed: ItemMap = seedItems) {
    this.data = new Map(
      Object.entries(seed).map(([collection, rows]) => [
        collection,
        new Map(rows.map((row) => [row.id, structuredClone(row)])),
      ]),
    );
  }

  protected table(collection: string): Map<string, Item> {
    let table = this.data.get(collection);
    if (!table) {
      table = new Map();
      this.data.set(collection, table);
    }
    return table;
  }

  async fetchCollection<T = Record<string, unknown>>(
    collection: string,
    query?: Query,
  ): Promise<(T & { id: string })[]> {
    return applyQuery([...this.table(collection).values()], query).map(
      (row) => structuredClone(row) as T & { id: string },
    );
  }

  async fetchById<T = Record<string, unknown>>(
    collection: string,
    id: string,
  ): Promise<(T & { id: string }) | null> {
    const item = this.table(collection).get(id);
    return item ? (structuredClone(item) as T & { id: string }) : null;
  }

  async create<T = Record<string, unknown>>(
    collection: string,
    data: T,
  ): Promise<T & { id: string }> {
    return this.createWithId(collection, crypto.randomUUID(), data);
  }

  async createWithId<T = Record<string, unknown>>(
    collection: string,
    id: string,
    data: T,
  ): Promise<T & { id: string }> {
    const item = { id, ...(data as Record<string, unknown>) } as T & {
      id: string;
    };
    this.table(collection).set(id, structuredClone(item));
    return item;
  }

  async update<T = Record<string, unknown>>(
    collection: string,
    id: string,
    data: Partial<T>,
  ): Promise<void> {
    const existing = this.table(collection).get(id);
    if (!existing) {
      throw new Error(`Cannot update missing row ${collection}/${id}`);
    }
    this.table(collection).set(id, { ...existing, ...data, id });
  }

  async upsert<T = Record<string, unknown>>(
    collection: string,
    id: string,
    data: Partial<T>,
  ): Promise<void> {
    const existing = this.table(collection).get(id) ?? { id };
    this.table(collection).set(id, { ...existing, ...data, id });
  }

  async delete(collection: string, id: string): Promise<void> {
    this.table(collection).delete(id);
  }
}

class MockRestAdapter extends MapDataAdapter {
  private wait() {
    return new Promise((resolve) => setTimeout(resolve, 120));
  }

  private log(line: string, payload?: unknown) {
    console.info(`[mock-rest] ${line}`, payload ?? "");
  }

  override async fetchCollection<T = Record<string, unknown>>(
    collection: string,
    query?: Query,
  ): Promise<(T & { id: string })[]> {
    await this.wait();
    this.log(`GET /${collection}`, query);
    return super.fetchCollection(collection, query);
  }

  override async fetchById<T = Record<string, unknown>>(
    collection: string,
    id: string,
  ): Promise<(T & { id: string }) | null> {
    await this.wait();
    this.log(`GET /${collection}/${id}`);
    return super.fetchById(collection, id);
  }

  override async update<T = Record<string, unknown>>(
    collection: string,
    id: string,
    data: Partial<T>,
  ): Promise<void> {
    await this.wait();
    this.log(`PATCH /${collection}/${id}`, data);
    return super.update(collection, id, data);
  }

  override async upsert<T = Record<string, unknown>>(
    collection: string,
    id: string,
    data: Partial<T>,
  ): Promise<void> {
    await this.wait();
    this.log(`PUT /${collection}/${id}`, data);
    return super.upsert(collection, id, data);
  }

  override async delete(collection: string, id: string): Promise<void> {
    await this.wait();
    this.log(`DELETE /${collection}/${id}`);
    return super.delete(collection, id);
  }
}

function readAdapterId(): AdapterId {
  if (typeof window === "undefined") return "memory";
  const hash = new URLSearchParams(window.location.hash.slice(1));
  const candidate =
    (hash.get("adapter") as AdapterId | null) ??
    (localStorage.getItem("bc-playground-adapter") as AdapterId | null) ??
    "memory";
  return adapterOptions.some((option) => option.id === candidate)
    ? candidate
    : "memory";
}

export const activeAdapterId = readAdapterId();

const memoryAdapter = new MapDataAdapter();
const restAdapter = new MockRestAdapter();

export const adapter: DataAdapter =
  activeAdapterId === "memory"
    ? memoryAdapter
    : activeAdapterId === "rest"
      ? restAdapter
      : pgliteAdapter;

async function seedThrough(target: DataAdapter): Promise<void> {
  for (const [collection, rows] of Object.entries(seedItems)) {
    for (const { id, ...fields } of rows) {
      await target.createWithId(collection, id, fields);
    }
  }
}

export async function initDb(): Promise<void> {
  if (activeAdapterId !== "pglite") return;
  await client.exec(DDL);
  const existing = await client.query<{ n: number }>(
    "SELECT count(*)::int AS n FROM page",
  );
  if ((existing.rows[0]?.n ?? 0) === 0) {
    await seedThrough(pgliteAdapter);
  }
}

export async function resetDemo(): Promise<void> {
  if (activeAdapterId === "pglite") {
    await client.exec('DELETE FROM page; DELETE FROM cards;');
    await seedThrough(pgliteAdapter);
  } else {
    (adapter as MapDataAdapter).replace(seedItems);
  }
  location.reload();
}

export function setAdapter(id: AdapterId): void {
  localStorage.setItem("bc-playground-adapter", id);
  const params = new URLSearchParams(window.location.hash.slice(1));
  params.set("adapter", id);
  window.location.hash = params.toString();
  window.location.reload();
}
