import { describe, expect, it, vi } from "vitest";
import { createCmsEngine } from "../src/core/engine";
import { inMemoryTransport, type Transport } from "../src/core/transport";
import type { Notifier } from "../src/core/notifier";

const silentNotifier: Notifier = { success: () => {}, error: () => {} };

const engineWith = (overrides: Partial<Parameters<typeof createCmsEngine>[0]> = {}) => {
  const transport = inMemoryTransport();
  const engine = createCmsEngine({
    transport,
    notify: silentNotifier,
    ...overrides,
  });
  return { engine, transport };
};

describe("store contract", () => {
  it("returns a stable snapshot between changes and a new one after", () => {
    const { engine } = engineWith();
    const before = engine.getSnapshot();
    expect(engine.getSnapshot()).toBe(before);
    engine.editField("posts", "a1", "title", "x");
    const after = engine.getSnapshot();
    expect(after).not.toBe(before);
    expect(engine.getSnapshot()).toBe(after);
  });

  it("notifies subscribers on change and stops after unsubscribe", () => {
    const { engine } = engineWith();
    const listener = vi.fn();
    const unsubscribe = engine.subscribe(listener);
    engine.editField("posts", "a1", "title", "x");
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    engine.editField("posts", "a1", "title", "y");
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("editField", () => {
  it("applies the edit to the snapshot and marks it dirty", () => {
    const { engine } = engineWith({
      initialItems: { posts: [{ id: "a1", title: "old" }] },
    });
    engine.editField("posts", "a1", "title", "new");
    expect(engine.getItem("posts", "a1")?.title).toBe("new");
    expect(engine.getSnapshot().hasUnsavedChanges).toBe(true);
  });

  it("creates the item when the id does not exist yet", () => {
    const { engine } = engineWith();
    engine.editField("sections", "hero", "heading", "Welcome");
    expect(engine.getItem("sections", "hero")).toEqual({
      id: "hero",
      heading: "Welcome",
    });
  });

  it("supports dotted paths", () => {
    const { engine } = engineWith({
      initialItems: { sections: [{ id: "hero", cta: { label: "Go" } }] },
    });
    engine.editField("sections", "hero", "cta.label", "Start");
    expect(engine.getItem("sections", "hero")?.cta).toEqual({ label: "Start" });
  });
});

describe("saveAll", () => {
  it("persists every dirty item and clears the dirty state", async () => {
    const { engine, transport } = engineWith();
    engine.editField("posts", "a1", "title", "one");
    engine.editField("sections", "hero", "heading", "two");
    await engine.saveAll();
    expect(transport.get("posts", "a1")?.title).toBe("one");
    expect(transport.get("sections", "hero")?.heading).toBe("two");
    expect(engine.getSnapshot().hasUnsavedChanges).toBe(false);
  });

  it("does nothing when nothing is dirty", async () => {
    const transport = inMemoryTransport();
    const save = vi.spyOn(transport, "save");
    const engine = createCmsEngine({ transport, notify: silentNotifier });
    await engine.saveAll();
    expect(save).not.toHaveBeenCalled();
  });

  it("notifies error and keeps running state consistent on failure", async () => {
    const error = vi.fn();
    const failing: Transport = {
      save: async () => {
        throw new Error("boom");
      },
      patch: async () => {},
      remove: async () => {},
    };
    const engine = createCmsEngine({
      transport: failing,
      notify: { success: () => {}, error },
    });
    engine.editField("posts", "a1", "title", "x");
    await engine.saveAll();
    expect(error).toHaveBeenCalledWith("Failed to save changes");
    expect(engine.getSnapshot().saving).toBe(false);
    expect(engine.getSnapshot().hasUnsavedChanges).toBe(true);
  });
});

describe("saveItem", () => {
  it("persists only the addressed item", async () => {
    const { engine, transport } = engineWith();
    engine.editField("posts", "a1", "title", "saved");
    engine.editField("posts", "b2", "title", "still dirty");
    await engine.saveItem("posts", "a1");
    expect(transport.get("posts", "a1")?.title).toBe("saved");
    expect(transport.get("posts", "b2")).toBeUndefined();
    expect(engine.getSnapshot().hasUnsavedChanges).toBe(true);
  });

  it("ignores reentrant saves while one is in flight", async () => {
    let resolveSave!: () => void;
    const gate = new Promise<void>((r) => (resolveSave = r));
    let saves = 0;
    const slow: Transport = {
      save: async () => {
        saves++;
        await gate;
      },
      patch: async () => {},
      remove: async () => {},
    };
    const engine = createCmsEngine({ transport: slow, notify: silentNotifier });
    engine.editField("posts", "a1", "title", "x");
    const first = engine.saveItem("posts", "a1");
    expect(engine.getSnapshot().saving).toBe(true);
    await engine.saveItem("posts", "a1");
    resolveSave();
    await first;
    expect(saves).toBe(1);
    expect(engine.getSnapshot().saving).toBe(false);
  });
});

describe("pending images", () => {
  it("dedupes by collection + item + field", () => {
    const { engine } = engineWith();
    const img = {
      file: null,
      collection: "posts",
      itemId: "a1",
      fieldKey: "cover",
      isExternal: true,
    };
    engine.setPendingImage({ ...img, localUrl: "https://a.test/1.png" });
    engine.setPendingImage({ ...img, localUrl: "https://a.test/2.png" });
    const pending = engine.getSnapshot().pendingImages;
    expect(pending).toHaveLength(1);
    expect(pending[0]?.localUrl).toBe("https://a.test/2.png");
  });

  it("uses the external url directly on save", async () => {
    const { engine, transport } = engineWith();
    engine.setPendingImage({
      file: null,
      localUrl: "https://a.test/pic.png",
      collection: "posts",
      itemId: "a1",
      fieldKey: "cover",
      isExternal: true,
    });
    await engine.saveAll();
    expect(transport.get("posts", "a1")?.cover).toBe("https://a.test/pic.png");
    expect(engine.getSnapshot().pendingImages).toHaveLength(0);
  });

  it("uploads files through the storage adapter on save", async () => {
    const upload = vi.fn(async () => ({ url: "https://cdn.test/final.png" }));
    const { engine, transport } = engineWith({ storage: { upload } });
    const file = new File(["x"], "pic.png", { type: "image/png" });
    engine.setPendingImage({
      file,
      localUrl: "blob:local",
      collection: "posts",
      itemId: "a1",
      fieldKey: "cover",
    });
    await engine.saveAll();
    expect(upload).toHaveBeenCalledWith(file);
    expect(transport.get("posts", "a1")?.cover).toBe("https://cdn.test/final.png");
  });

  it("fails the save when a file upload has no storage adapter", async () => {
    const error = vi.fn();
    const { engine } = engineWith({ notify: { success: () => {}, error } });
    engine.setPendingImage({
      file: new File(["x"], "pic.png"),
      localUrl: "blob:local",
      collection: "posts",
      itemId: "a1",
      fieldKey: "cover",
    });
    await engine.saveAll();
    expect(error).toHaveBeenCalledWith("Failed to save changes");
    expect(engine.getSnapshot().hasUnsavedChanges).toBe(true);
  });
});

describe("createItem", () => {
  it("persists and returns the generated id", async () => {
    const { engine, transport } = engineWith();
    const id = await engine.createItem("posts", { title: "new" });
    expect(id).toBeTruthy();
    expect(transport.get("posts", id)).toEqual({ id, title: "new" });
    expect(engine.getItem("posts", id)?.title).toBe("new");
  });

  it("honours an explicit id and atStart", async () => {
    const { engine } = engineWith({
      initialItems: { posts: [{ id: "existing" }] },
    });
    await engine.createItem("posts", {}, { id: "first", atStart: true });
    expect(engine.getSnapshot().items.posts?.map((it) => it.id)).toEqual([
      "first",
      "existing",
    ]);
  });

  it("rolls back the optimistic insert on failure", async () => {
    const failing: Transport = {
      save: async () => {
        throw new Error("boom");
      },
      patch: async () => {},
      remove: async () => {},
    };
    const engine = createCmsEngine({ transport: failing, notify: silentNotifier });
    await expect(engine.createItem("posts", { title: "x" })).rejects.toThrow();
    expect(engine.getSnapshot().items.posts).toEqual([]);
  });
});

describe("updateItem", () => {
  it("patches optimistically and persists", async () => {
    const { engine, transport } = engineWith({
      initialItems: { posts: [{ id: "a1", title: "old", views: 1 }] },
    });
    await transport.save("posts", "a1", { id: "a1", title: "old", views: 1 });
    await engine.updateItem("posts", "a1", { title: "new" });
    expect(engine.getItem("posts", "a1")).toEqual({
      id: "a1",
      title: "new",
      views: 1,
    });
    expect(transport.get("posts", "a1")?.title).toBe("new");
  });

  it("rolls back on failure", async () => {
    const failing: Transport = {
      save: async () => {},
      patch: async () => {
        throw new Error("boom");
      },
      remove: async () => {},
    };
    const engine = createCmsEngine({
      transport: failing,
      notify: silentNotifier,
      initialItems: { posts: [{ id: "a1", title: "old" }] },
    });
    await expect(engine.updateItem("posts", "a1", { title: "new" })).rejects.toThrow();
    expect(engine.getItem("posts", "a1")?.title).toBe("old");
  });
});

describe("deleteItem", () => {
  it("removes optimistically and persists", async () => {
    const { engine, transport } = engineWith({
      initialItems: { posts: [{ id: "a1" }, { id: "b2" }] },
    });
    await transport.save("posts", "a1", { id: "a1" });
    await engine.deleteItem("posts", "a1");
    expect(engine.getItem("posts", "a1")).toBeUndefined();
    expect(transport.get("posts", "a1")).toBeUndefined();
    expect(engine.getItem("posts", "b2")).toBeDefined();
  });

  it("rolls back on failure", async () => {
    const failing: Transport = {
      save: async () => {},
      patch: async () => {},
      remove: async () => {
        throw new Error("boom");
      },
    };
    const engine = createCmsEngine({
      transport: failing,
      notify: silentNotifier,
      initialItems: { posts: [{ id: "a1" }] },
    });
    await expect(engine.deleteItem("posts", "a1")).rejects.toThrow();
    expect(engine.getItem("posts", "a1")).toBeDefined();
  });
});

describe("reorderItems", () => {
  it("reindexes order and persists each patch", async () => {
    const { engine, transport } = engineWith({
      initialItems: { posts: [{ id: "a" }, { id: "b" }, { id: "c" }] },
    });
    for (const id of ["a", "b", "c"]) {
      await transport.save("posts", id, { id });
    }
    await engine.reorderItems("posts", ["c", "a", "b"]);
    expect(
      engine.getSnapshot().items.posts?.map((it) => [it.id, it.order]),
    ).toEqual([
      ["c", 0],
      ["a", 1],
      ["b", 2],
    ]);
    expect(transport.get("posts", "c")?.order).toBe(0);
    expect(transport.get("posts", "b")?.order).toBe(2);
  });

  it("drops unknown ids from the new order", async () => {
    const { engine, transport } = engineWith({
      initialItems: { posts: [{ id: "a" }] },
    });
    await transport.save("posts", "a", { id: "a" });
    await engine.reorderItems("posts", ["ghost", "a"]);
    expect(engine.getSnapshot().items.posts?.map((it) => it.id)).toEqual(["a"]);
  });

  it("rolls back on failure", async () => {
    const failing: Transport = {
      save: async () => {},
      patch: async () => {
        throw new Error("boom");
      },
      remove: async () => {},
    };
    const engine = createCmsEngine({
      transport: failing,
      notify: silentNotifier,
      initialItems: { posts: [{ id: "a" }, { id: "b" }] },
    });
    await expect(engine.reorderItems("posts", ["b", "a"])).rejects.toThrow();
    expect(engine.getSnapshot().items.posts?.map((it) => it.id)).toEqual([
      "a",
      "b",
    ]);
  });
});
