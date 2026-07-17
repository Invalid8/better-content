import {
  adapterTransport,
  createCmsEngine,
  type ClientStorageAdapter,
  type CmsEngine,
} from "better-content/core";
import { loadItemMap } from "better-content/server";
import { adapter, initDb } from "./db";
import { statusStore } from "./status";

// Uploaded images become data URLs so the whole demo stays inside your tab.
// In a real app this would be a storage adapter like cloudinary.
const dataUrlStorage: ClientStorageAdapter = {
  upload: (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ url: reader.result as string });
      reader.onerror = () => reject(new Error("Could not read file"));
      reader.readAsDataURL(file);
    }),
};

// ONE engine for the whole page. Every island below, whatever its
// framework, binds to this exact object. The engine itself never
// imports React, Vue, or Svelte.
export const ready: Promise<CmsEngine> = (async () => {
  await initDb();

  const initialItems = await loadItemMap(adapter, {
    page: {},
    cards: { query: { orderBy: [{ field: "order", direction: "asc" }] } },
  });

  return createCmsEngine({
    transport: adapterTransport(adapter),
    storage: dataUrlStorage,
    notify: { success: statusStore.set, error: statusStore.set },
    initialItems,
  });
})();
