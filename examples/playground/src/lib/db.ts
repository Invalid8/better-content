import type { DataAdapter, Item, Query } from "better-content/core";
import { seedItems } from "./seed";

export { seedItems };

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
    // The DataAdapter contract: reject an id that already exists.
    if (this.table(collection).has(id)) {
      throw new Error(`${collection}/${id} already exists`);
    }
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
    (localStorage.getItem("bc-adapter") as AdapterId | null) ??
    "memory";
  return adapterOptions.some((option) => option.id === candidate)
    ? candidate
    : "memory";
}

export const activeAdapterId = readAdapterId();

let loaded: DataAdapter | null = null;

export async function loadAdapter(): Promise<DataAdapter> {
  if (loaded) return loaded;

  if (activeAdapterId === "pglite") {
    const pglite = await import("./pgliteAdapter");
    await pglite.init();
    loaded = pglite.adapter;
    return loaded;
  }

  loaded =
    activeAdapterId === "rest" ? new MockRestAdapter() : new MapDataAdapter();
  return loaded;
}

export async function resetDemo(): Promise<void> {
  if (activeAdapterId === "pglite") {
    const pglite = await import("./pgliteAdapter");
    await pglite.reset();
  } else if (loaded) {
    (loaded as MapDataAdapter).replace(seedItems);
  }
  location.reload();
}

export function setAdapter(id: AdapterId): void {
  localStorage.setItem("bc-adapter", id);
  const params = new URLSearchParams(window.location.hash.slice(1));
  params.set("adapter", id);
  window.location.hash = params.toString();
  window.location.reload();
}
