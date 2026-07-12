import { dirtyKey, setPath } from "./helpers";
import { consoleNotifier, type Notifier } from "./notifier";
import type { Transport } from "./transport";
import type { ClientStorageAdapter, Item, ItemMap, PendingImage } from "./types";

export interface CmsSnapshot {
  items: ItemMap;
  pendingImages: PendingImage[];
  saving: boolean;
  hasUnsavedChanges: boolean;
}

export interface CreateItemOptions {
  id?: string;
  atStart?: boolean;
}

export interface CmsEngineOptions {
  transport: Transport;
  storage?: ClientStorageAdapter;
  notify?: Notifier;
  initialItems?: ItemMap;
}

export interface CmsEngine {
  getSnapshot(): CmsSnapshot;
  subscribe(listener: () => void): () => void;
  getItem(collection: string, id: string): Item | undefined;
  editField(
    collection: string,
    id: string,
    fieldKey: string,
    value: unknown,
  ): void;
  setPendingImage(image: PendingImage): void;
  saveItem(collection: string, id: string): Promise<void>;
  saveAll(): Promise<void>;
  createItem(
    collection: string,
    data: Record<string, unknown>,
    opts?: CreateItemOptions,
  ): Promise<string>;
  updateItem(
    collection: string,
    id: string,
    patch: Record<string, unknown>,
  ): Promise<void>;
  deleteItem(collection: string, id: string): Promise<void>;
  reorderItems(collection: string, orderedIds: string[]): Promise<void>;
}

export function createCmsEngine(options: CmsEngineOptions): CmsEngine {
  const { transport, storage, notify = consoleNotifier } = options;

  let items: ItemMap = options.initialItems ?? {};
  let dirty = new Set<string>();
  let pendingImages: PendingImage[] = [];
  let saving = false;

  const listeners = new Set<() => void>();

  const buildSnapshot = (): CmsSnapshot => ({
    items,
    pendingImages,
    saving,
    hasUnsavedChanges: dirty.size > 0,
  });

  let snapshot = buildSnapshot();

  const emit = () => {
    snapshot = buildSnapshot();
    for (const listener of listeners) listener();
  };

  const getItem = (collection: string, id: string): Item | undefined =>
    items[collection]?.find((it) => it.id === id);

  const replaceList = (collection: string, list: Item[]) => {
    items = { ...items, [collection]: list };
  };

  const upsertLocal = (collection: string, id: string, item: Item) => {
    const list = items[collection] ?? [];
    replaceList(
      collection,
      list.some((it) => it.id === id)
        ? list.map((it) => (it.id === id ? item : it))
        : [...list, item],
    );
  };

  const markDirty = (collection: string, id: string) => {
    dirty = new Set(dirty).add(dirtyKey(collection, id));
  };

  const clearDirty = (collection: string, id: string) => {
    const next = new Set(dirty);
    next.delete(dirtyKey(collection, id));
    dirty = next;
  };

  const resolveImageUrl = async (img: PendingImage): Promise<string> => {
    if (img.isExternal) return img.localUrl;
    if (!storage) {
      throw new Error(
        "createCmsEngine received a file upload but no `storage` adapter was provided.",
      );
    }
    const { url } = await storage.upload(img.file!);
    return url;
  };

  const flush = async (collection: string, id: string): Promise<void> => {
    const images = pendingImages.filter(
      (img) => img.collection === collection && img.itemId === id,
    );

    let item = getItem(collection, id) ?? ({ id } as Item);
    for (const img of images) {
      const url = await resolveImageUrl(img);
      item = setPath(item, img.fieldKey, url) as Item;
    }

    await transport.save(collection, id, item);

    upsertLocal(collection, id, item);
    pendingImages = pendingImages.filter(
      (img) => !(img.collection === collection && img.itemId === id),
    );
    clearDirty(collection, id);
  };

  return {
    getSnapshot: () => snapshot,

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    getItem,

    editField(collection, id, fieldKey, value) {
      const existing = getItem(collection, id) ?? ({ id } as Item);
      upsertLocal(collection, id, setPath(existing, fieldKey, value) as Item);
      markDirty(collection, id);
      emit();
    },

    setPendingImage(image) {
      pendingImages = [
        ...pendingImages.filter(
          (img) =>
            !(
              img.collection === image.collection &&
              img.itemId === image.itemId &&
              img.fieldKey === image.fieldKey
            ),
        ),
        image,
      ];
      markDirty(image.collection, image.itemId);
      emit();
    },

    async saveItem(collection, id) {
      if (saving) return;
      saving = true;
      emit();
      try {
        await flush(collection, id);
        notify.success("Changes saved successfully!");
      } catch {
        notify.error("Failed to save changes");
      } finally {
        saving = false;
        emit();
      }
    },

    async saveAll() {
      if (saving || dirty.size === 0) return;
      saving = true;
      emit();
      try {
        for (const entry of [...dirty]) {
          const separator = entry.indexOf(":");
          const collection = entry.slice(0, separator);
          const id = entry.slice(separator + 1);
          await flush(collection, id);
        }
        notify.success("All changes saved successfully!");
      } catch {
        notify.error("Failed to save changes");
      } finally {
        saving = false;
        emit();
      }
    },

    async createItem(collection, data, opts) {
      const id =
        opts?.id ??
        globalThis.crypto?.randomUUID?.() ??
        `${collection}-${Date.now()}`;
      const item: Item = { id, ...data };

      const list = items[collection] ?? [];
      replaceList(collection, opts?.atStart ? [item, ...list] : [...list, item]);
      emit();

      try {
        await transport.save(collection, id, item);
        notify.success("Item added");
        return id;
      } catch (error) {
        replaceList(
          collection,
          (items[collection] ?? []).filter((it) => it.id !== id),
        );
        emit();
        notify.error("Failed to add item");
        throw error;
      }
    },

    async updateItem(collection, id, patch) {
      const previous = items[collection] ?? [];
      replaceList(
        collection,
        previous.map((it) => (it.id === id ? { ...it, ...patch } : it)),
      );
      emit();

      try {
        await transport.patch(collection, id, patch);
        notify.success("Saved");
      } catch (error) {
        replaceList(collection, previous);
        emit();
        notify.error("Failed to save");
        throw error;
      }
    },

    async deleteItem(collection, id) {
      const previous = items[collection] ?? [];
      replaceList(
        collection,
        previous.filter((it) => it.id !== id),
      );
      emit();

      try {
        await transport.remove(collection, id);
        notify.success("Item removed");
      } catch (error) {
        replaceList(collection, previous);
        emit();
        notify.error("Failed to remove item");
        throw error;
      }
    },

    async reorderItems(collection, orderedIds) {
      const previous = items[collection] ?? [];
      const byId = new Map(previous.map((it) => [it.id, it]));
      const next = orderedIds.flatMap((id, index) => {
        const item = byId.get(id);
        return item ? [{ ...item, order: index }] : [];
      });
      replaceList(collection, next);
      emit();

      try {
        await Promise.all(
          next.map((it) => transport.patch(collection, it.id, { order: it.order })),
        );
        notify.success("Order updated");
      } catch (error) {
        replaceList(collection, previous);
        emit();
        notify.error("Failed to update order");
        throw error;
      }
    },
  };
}
