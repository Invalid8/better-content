import type { DataAdapter, Item, ItemMap } from "./types";

export interface Transport {
  save(collection: string, id: string, item: Item): Promise<void>;
  patch(
    collection: string,
    id: string,
    partial: Record<string, unknown>,
  ): Promise<void>;
  remove(collection: string, id: string): Promise<void>;
}

export interface RestTransportOptions {
  apiBasePath?: string;
}

export function restTransport({
  apiBasePath = "/api/admin",
}: RestTransportOptions = {}): Transport {
  const url = (collection: string, id: string) =>
    `${apiBasePath}/${encodeURIComponent(collection)}/${encodeURIComponent(id)}`;

  return {
    async save(collection, id, item) {
      const res = await fetch(url(collection, id), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
      });
      if (!res.ok) throw new Error("Failed to save item");
    },
    async patch(collection, id, partial) {
      const res = await fetch(url(collection, id), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(partial),
      });
      if (!res.ok) throw new Error("Failed to update item");
    },
    async remove(collection, id) {
      const res = await fetch(url(collection, id), { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete item");
    },
  };
}

export function adapterTransport(data: DataAdapter): Transport {
  return {
    async save(collection, id, item) {
      await data.upsert(collection, id, item);
    },
    async patch(collection, id, partial) {
      await data.update(collection, id, partial);
    },
    async remove(collection, id) {
      await data.delete(collection, id);
    },
  };
}

export interface InMemoryTransport extends Transport {
  get(collection: string, id: string): Item | undefined;
  list(collection: string): Item[];
}

export function inMemoryTransport(seed: ItemMap = {}): InMemoryTransport {
  const data = new Map<string, Map<string, Item>>();
  for (const [collection, list] of Object.entries(seed)) {
    data.set(collection, new Map(list.map((it) => [it.id, { ...it }])));
  }

  const table = (collection: string): Map<string, Item> => {
    let t = data.get(collection);
    if (!t) {
      t = new Map();
      data.set(collection, t);
    }
    return t;
  };

  return {
    async save(collection, id, item) {
      table(collection).set(id, { ...item, id });
    },
    async patch(collection, id, partial) {
      const existing = table(collection).get(id);
      if (!existing) {
        throw new Error(`Cannot patch missing item ${collection}/${id}`);
      }
      table(collection).set(id, { ...existing, ...partial, id });
    },
    async remove(collection, id) {
      table(collection).delete(id);
    },
    get(collection, id) {
      return table(collection).get(id);
    },
    list(collection) {
      return [...table(collection).values()];
    },
  };
}
