import type { DataAdapter, Item, Query } from "better-content/core";

const data = new Map<string, Map<string, Item>>();

const table = (collection: string) => {
  let rows = data.get(collection);
  if (!rows) {
    rows = new Map();
    data.set(collection, rows);
  }
  return rows;
};

const sortRows = (rows: Item[], query?: Query) => {
  const order = query?.orderBy?.[0];
  if (!order) return rows;
  return rows.sort((a, b) =>
    ((a[order.field] as number) ?? 0) - ((b[order.field] as number) ?? 0),
  );
};

export const adapter: DataAdapter = {
  async fetchCollection<T>(collection: string, query?: Query) {
    const rows = sortRows([...table(collection).values()], query);
    return rows as (T & { id: string })[];
  },
  async fetchById<T>(collection: string, id: string) {
    return (table(collection).get(id) ?? null) as (T & { id: string }) | null;
  },
  async create(collection, fields) {
    const item = { id: crypto.randomUUID(), ...fields };
    table(collection).set(item.id, item);
    return item;
  },
  async createWithId(collection, id, fields) {
    const item = { id, ...fields };
    table(collection).set(id, item);
    return item;
  },
  async update(collection, id, patch) {
    table(collection).set(id, { ...table(collection).get(id), ...patch, id });
  },
  async upsert(collection, id, patch) {
    table(collection).set(id, { ...table(collection).get(id), ...patch, id });
  },
  async delete(collection, id) {
    table(collection).delete(id);
  },
};
