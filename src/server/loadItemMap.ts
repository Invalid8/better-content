import type { DataAdapter, Item, ItemMap, Query } from "better-content/core";

export interface ItemCollectionLoadConfig {
  query?: Query;
  defaults?: Item[];
  merge?: "replace" | "byId";
  fallback?: Item[];
}

export type ItemMapLoadConfig = Record<string, ItemCollectionLoadConfig>;

export async function loadItemMap(
  data: DataAdapter,
  collections: ItemMapLoadConfig,
): Promise<ItemMap> {
  const entries = await Promise.all(
    Object.entries(collections).map(
      async ([collection, config]): Promise<[string, Item[]]> => {
        try {
          const rows = (await data.fetchCollection(
            collection,
            config.query,
          )) as Item[];
          if (config.merge !== "byId") {
            return [collection, rows];
          }

          const byId = new Map<string, Item>();
          for (const item of config.defaults ?? []) {
            byId.set(item.id, { ...item });
          }
          for (const row of rows) {
            const id = String(row.id);
            byId.set(id, { ...(byId.get(id) ?? { id }), ...row, id });
          }
          return [collection, [...byId.values()]];
        } catch (error) {
          if (config.fallback === undefined) throw error;
          return [collection, config.fallback.map((item) => ({ ...item }))];
        }
      },
    ),
  );

  return Object.fromEntries(entries);
}
