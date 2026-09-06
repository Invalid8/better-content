import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { PostgresDataAdapter } from "../src/adapters/postgres";
import { FirestoreDataAdapter } from "../src/adapters/firestore";
import { seedItemMap } from "../src/server/seedItemMap";
import { loadItemMap } from "../src/server/loadItemMap";
import type { DataAdapter, Item } from "../src/core/types";

type Op = { op: string; collection: string; id: string };

/**
 * A fake backend that both stores records and records the call order, because
 * "a replace is delete then createWithId" is a claim about ordering that a
 * final-state assertion cannot make.
 */
function fakeAdapter(seed: Record<string, Item[]> = {}) {
  const store = new Map<string, Map<string, Item>>();
  for (const [collection, items] of Object.entries(seed)) {
    store.set(collection, new Map(items.map((item) => [item.id, item])));
  }
  const ops: Op[] = [];
  const table = (collection: string) => {
    let t = store.get(collection);
    if (!t) store.set(collection, (t = new Map()));
    return t;
  };

  const adapter: DataAdapter = {
    async fetchCollection(collection) {
      ops.push({ op: "fetchCollection", collection, id: "" });
      return [...table(collection).values()] as never;
    },
    async fetchById(collection, id) {
      return (table(collection).get(id) ?? null) as never;
    },
    create: vi.fn() as unknown as DataAdapter["create"],
    async createWithId(collection, id, data) {
      ops.push({ op: "createWithId", collection, id });
      if (table(collection).has(id)) {
        throw new Error(`"${collection}/${id}" already exists`);
      }
      const record = { id, ...(data as Record<string, unknown>) } as Item;
      table(collection).set(id, record);
      return record as never;
    },
    update: vi.fn(async () => {}),
    upsert: vi.fn(async () => {}),
    async delete(collection, id) {
      ops.push({ op: "delete", collection, id });
      table(collection).delete(id);
    },
  };

  return {
    adapter,
    ops,
    ids: (collection: string) => [...table(collection).keys()].sort(),
    get: (collection: string, id: string) => table(collection).get(id),
  };
}

describe("seedItemMap", () => {
  describe("byId, the default", () => {
    it("writes the named ids and deletes nothing else", async () => {
      const backend = fakeAdapter({
        portfolio: [
          { id: "hero", title: "Old hero" },
          { id: "untouched", title: "Leave me" },
        ],
      });

      await seedItemMap(backend.adapter, {
        portfolio: [{ id: "hero", title: "New hero" }],
      });

      expect(backend.ids("portfolio")).toEqual(["hero", "untouched"]);
      expect(backend.get("portfolio", "hero")).toEqual({
        id: "hero",
        title: "New hero",
      });
      expect(backend.get("portfolio", "untouched")).toEqual({
        id: "untouched",
        title: "Leave me",
      });
    });

    it("never reads the collection, since it does not need to", async () => {
      const backend = fakeAdapter({ portfolio: [{ id: "hero" }] });
      await seedItemMap(backend.adapter, { portfolio: [{ id: "hero" }] });
      expect(backend.ops.some((o) => o.op === "fetchCollection")).toBe(false);
    });
  });

  describe("replace", () => {
    it("deletes exactly the backend ids absent from the seed", async () => {
      const backend = fakeAdapter({
        projects: [{ id: "keep" }, { id: "stale" }, { id: "also-stale" }],
      });

      await seedItemMap(backend.adapter, {
        projects: { items: [{ id: "keep" }, { id: "new" }], mode: "replace" },
      });

      expect(backend.ids("projects")).toEqual(["keep", "new"]);
    });

    it("empties the collection when seeded with an empty array", async () => {
      const backend = fakeAdapter({ projects: [{ id: "a" }, { id: "b" }] });

      await seedItemMap(backend.adapter, {
        projects: { items: [], mode: "replace" },
      });

      expect(backend.ids("projects")).toEqual([]);
    });
  });

  it("writes each record as delete then createWithId, in that order", async () => {
    const backend = fakeAdapter({ portfolio: [{ id: "hero", title: "Old" }] });

    await seedItemMap(backend.adapter, {
      portfolio: [{ id: "hero", title: "New" }],
    });

    expect(backend.ops).toEqual([
      { op: "delete", collection: "portfolio", id: "hero" },
      { op: "createWithId", collection: "portfolio", id: "hero" },
    ]);
  });

  it("strips the adapter's own metadata rather than writing it as fields", async () => {
    const backend = fakeAdapter();
    const createWithId = vi.spyOn(backend.adapter, "createWithId");

    // The shape a snapshot read back from a backend actually has.
    await seedItemMap(backend.adapter, {
      portfolio: [
        {
          id: "hero",
          collection: "portfolio",
          createdAt: "2020-01-01T00:00:00.000Z",
          updatedAt: "2020-01-01T00:00:00.000Z",
          title: "Hello",
        },
      ],
    });

    expect(createWithId).toHaveBeenCalledWith("portfolio", "hero", {
      title: "Hello",
    });
  });

  it("addresses the record by id rather than storing id as a field", async () => {
    const backend = fakeAdapter();
    const createWithId = vi.spyOn(backend.adapter, "createWithId");

    await seedItemMap(backend.adapter, {
      portfolio: [{ id: "hero", title: "Hello" }],
    });

    expect(createWithId).toHaveBeenCalledWith("portfolio", "hero", {
      title: "Hello",
    });
  });

  describe("config shapes", () => {
    it("treats a bare array and the { items } form identically", async () => {
      const bare = fakeAdapter({ portfolio: [{ id: "gone" }] });
      const wrapped = fakeAdapter({ portfolio: [{ id: "gone" }] });
      const items: Item[] = [{ id: "hero", title: "Hello" }];

      await seedItemMap(bare.adapter, { portfolio: items });
      await seedItemMap(wrapped.adapter, { portfolio: { items } });

      expect(bare.ids("portfolio")).toEqual(wrapped.ids("portfolio"));
      expect(bare.get("portfolio", "hero")).toEqual(
        wrapped.get("portfolio", "hero"),
      );
    });

    it("accepts an ItemMap directly, so an environment can be copied", async () => {
      const source = fakeAdapter({
        portfolio: [{ id: "hero", title: "Hello" }],
        projects: [{ id: "one" }],
      });
      const target = fakeAdapter();

      const snapshot = await loadItemMap(source.adapter, {
        portfolio: {},
        projects: {},
      });
      await seedItemMap(target.adapter, snapshot);

      expect(target.ids("portfolio")).toEqual(["hero"]);
      expect(target.ids("projects")).toEqual(["one"]);
    });

    it("applies options.mode to collections that do not set their own", async () => {
      const backend = fakeAdapter({
        portfolio: [{ id: "stale" }],
        projects: [{ id: "stale" }],
      });

      await seedItemMap(
        backend.adapter,
        {
          portfolio: [{ id: "hero" }],
          projects: { items: [{ id: "one" }], mode: "byId" },
        },
        { mode: "replace" },
      );

      // portfolio took the run-wide replace; projects overrode it back to byId.
      expect(backend.ids("portfolio")).toEqual(["hero"]);
      expect(backend.ids("projects")).toEqual(["one", "stale"]);
    });
  });

  describe("failure", () => {
    it("throws naming the collection, the id and the writes that landed", async () => {
      const backend = fakeAdapter();
      vi.spyOn(backend.adapter, "createWithId").mockImplementation(
        async (collection, id) => {
          if (id === "second") throw new Error("backend exploded");
          return { id } as never;
        },
      );

      await expect(
        seedItemMap(backend.adapter, {
          portfolio: [{ id: "first" }, { id: "second" }],
        }),
      ).rejects.toThrow(
        /seedItemMap failed to create "portfolio\/second" after 1 successful write: backend exploded/,
      );
    });

    it("says the record was deleted and not rewritten, since it is gone", async () => {
      const backend = fakeAdapter({ portfolio: [{ id: "hero" }] });
      vi.spyOn(backend.adapter, "createWithId").mockRejectedValue(
        new Error("nope"),
      );

      await expect(
        seedItemMap(backend.adapter, { portfolio: [{ id: "hero" }] }),
      ).rejects.toThrow(/"portfolio\/hero" no longer exists/);

      expect(backend.ids("portfolio")).toEqual([]);
    });

    it("does not continue to later collections", async () => {
      const backend = fakeAdapter();
      vi.spyOn(backend.adapter, "createWithId").mockImplementation(
        async (collection, id) => {
          if (collection === "portfolio") throw new Error("nope");
          return { id } as never;
        },
      );

      await expect(
        seedItemMap(backend.adapter, {
          portfolio: [{ id: "hero" }],
          projects: [{ id: "one" }],
        }),
      ).rejects.toThrow();

      expect(backend.ops.some((o) => o.collection === "projects")).toBe(false);
    });

    it("keeps the original error as the cause", async () => {
      const backend = fakeAdapter();
      const cause = new Error("unique violation");
      vi.spyOn(backend.adapter, "createWithId").mockRejectedValue(cause);

      await expect(
        seedItemMap(backend.adapter, { portfolio: [{ id: "hero" }] }),
      ).rejects.toMatchObject({ cause });
    });
  });

  it("round trips: loadItemMap reads back exactly what was seeded", async () => {
    const backend = fakeAdapter({ portfolio: [{ id: "stale" }] });
    const seed = {
      portfolio: { items: [{ id: "hero", title: "Hello" }], mode: "replace" },
      projects: [{ id: "one", name: "One", order: 0 }],
    } as const;

    await seedItemMap(backend.adapter, {
      portfolio: { items: [...seed.portfolio.items], mode: "replace" },
      projects: [...seed.projects],
    });

    const read = await loadItemMap(backend.adapter, {
      portfolio: {},
      projects: {},
    });

    expect(read.portfolio).toEqual([{ id: "hero", title: "Hello" }]);
    expect(read.projects).toEqual([{ id: "one", name: "One", order: 0 }]);
  });
});

// The design's central claim is that a seed written the obvious way, as a loop
// of `upsert` calls, would look fine on Postgres and silently write records
// Firestore's default read cannot see, because `upsert` does not stamp
// `createdAt` and that is the field the default read orders by. These two
// exercise the real adapters rather than the fake above.

describe("seedItemMap against the Firestore adapter", () => {
  function writeStubDb(existing: string[] = []) {
    const writes: { op: string; id: string; keys: string[] }[] = [];
    const has = new Set(existing);
    const docRef = (id: string) => ({
      create: async (data: Record<string, unknown>) => {
        if (has.has(id)) throw new Error(`ALREADY_EXISTS: ${id}`);
        has.add(id);
        writes.push({ op: "create", id, keys: Object.keys(data) });
      },
      set: async (data: Record<string, unknown>) => {
        has.add(id);
        writes.push({ op: "set", id, keys: Object.keys(data) });
      },
      update: async () => {},
      delete: async () => {
        has.delete(id);
        writes.push({ op: "delete", id, keys: [] });
      },
    });
    const ref = {
      doc: docRef,
      where: () => ref,
      orderBy: () => ref,
      offset: () => ref,
      limit: () => ref,
      get: async () => ({ docs: [] }),
    };
    return { db: { collection: () => ref } as never, writes };
  }

  it("stamps createdAt on every seeded record, so a default read can see it", async () => {
    const { db, writes } = writeStubDb(["hero"]);
    const adapter = new FirestoreDataAdapter({ db });

    await seedItemMap(adapter, {
      portfolio: [{ id: "hero", title: "Replaced" }],
    });

    // delete-then-create, never set: `set` is the upsert path, and it is the
    // one that would leave the document without createdAt.
    expect(writes.map((w) => w.op)).toEqual(["delete", "create"]);
    expect(writes.find((w) => w.op === "create")?.keys).toContain("createdAt");
    expect(writes.some((w) => w.op === "set")).toBe(false);
  });
});

describe("seedItemMap against the Postgres adapter", () => {
  const projects = pgTable("projects", {
    id: text("id").primaryKey(),
    title: text("title"),
    order: integer("order"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  });
  const schema = { projects };

  let client: PGlite;
  let adapter: PostgresDataAdapter;

  beforeAll(async () => {
    client = new PGlite();
    await client.exec(`
      CREATE TABLE projects (
        id         text PRIMARY KEY,
        title      text,
        "order"    integer,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );
    `);
    adapter = new PostgresDataAdapter({
      db: drizzle(client, { schema }) as never,
      schema: schema as never,
    });
    // Booting PGlite's WASM runs well past the 10s default when this file and
    // postgres-adapter.test.ts start their instances in parallel. Same 60s
    // that file already uses.
  }, 60000);

  beforeEach(async () => {
    await client.exec("DELETE FROM projects;");
  });

  it("round trips through real SQL: seeded rows come back from a default read", async () => {
    await client.exec(
      "INSERT INTO projects (id, title) VALUES ('stale', 'Gone');",
    );

    await seedItemMap(adapter, {
      projects: {
        items: [
          { id: "one", title: "One", order: 0 },
          { id: "two", title: "Two", order: 1 },
        ],
        mode: "replace",
      },
    });

    const read = await loadItemMap(adapter, {
      projects: { query: { orderBy: [{ field: "order", direction: "asc" }] } },
    });

    expect(read.projects).toMatchObject([
      { id: "one", title: "One", order: 0 },
      { id: "two", title: "Two", order: 1 },
    ]);
    // Reads carry the adapter's timestamps on both backends now.
    expect(read.projects?.[0]).toHaveProperty("createdAt");
  });

  it("re-seeds its own snapshot unchanged", async () => {
    await seedItemMap(adapter, { projects: [{ id: "one", title: "One" }] });
    const snapshot = await loadItemMap(adapter, { projects: {} });
    expect(snapshot.projects?.[0]).not.toHaveProperty("collection");

    const createWithId = vi.spyOn(adapter, "createWithId");
    await seedItemMap(adapter, snapshot);

    // `order: null` remains because a SQL read returns every column, unset
    // ones included. That is the backend's shape, not an address, so the
    // seeder passes it through.
    // `order: null` remains because a SQL read returns every column, unset
    // ones included, and the timestamps ride along the same way. Those are the
    // backend's shape rather than the record's address, so the seeder passes
    // them through; `createWithId` stamps its own over them.
    expect(createWithId).toHaveBeenCalledWith(
      "projects",
      "one",
      expect.objectContaining({ title: "One", order: null }),
    );
    expect(createWithId.mock.calls[0]?.[2]).not.toHaveProperty("collection");
    createWithId.mockRestore();
  });

  it("leaves unnamed rows alone in byId mode", async () => {
    await client.exec(
      "INSERT INTO projects (id, title) VALUES ('keep', 'Keep me');",
    );

    await seedItemMap(adapter, { projects: [{ id: "one", title: "One" }] });

    const rows = await adapter.fetchCollection("projects");
    expect(rows.map((r) => r.id).sort()).toEqual(["keep", "one"]);
  });

  it("rejects a duplicate id only if the delete is skipped, proving the delete matters", async () => {
    await seedItemMap(adapter, { projects: [{ id: "one", title: "First" }] });
    // Seeding the same id again works precisely because of the delete step.
    await seedItemMap(adapter, { projects: [{ id: "one", title: "Second" }] });

    const row = await adapter.fetchById("projects", "one");
    expect(row).toMatchObject({ id: "one", title: "Second" });

    // Without it, createWithId is contractually required to reject.
    await expect(
      adapter.createWithId("projects", "one", { title: "Third" }),
    ).rejects.toThrow();
  });
});
