import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { PostgresDataAdapter } from "../src/adapters/postgres";
import { FirestoreDataAdapter } from "../src/adapters/firestore";
import type { DataAdapter } from "../src/core/types";

/**
 * The seam exists so that behaviour does not change when the backend does.
 * Write contracts are pinned per adapter already; this pins that the two
 * agree on the *shape they read back*, which is where they had quietly
 * diverged: the Postgres adapter used to add a `collection` field that
 * Firestore never returned.
 */

const projects = pgTable("projects", {
  id: text("id").primaryKey(),
  title: text("title"),
  order: integer("order"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

/** An in-memory stand-in for Firestore, faithful to the bits reads touch. */
function firestoreStub() {
  const docs = new Map<string, Record<string, unknown>>();
  // firebase-admin stores a Date as a Timestamp and hands one back on read.
  // The stub has to do the same or the adapter's serializer never sees the
  // shape it converts, and the test would pass on an unfaithful fake.
  const store = (data: Record<string, unknown>) =>
    Object.fromEntries(
      Object.entries(data).map(([k, v]) => [
        k,
        v instanceof Date ? { toDate: () => v } : v,
      ]),
    );
  const snapshot = (id: string, data: Record<string, unknown>) => ({
    id,
    exists: true,
    data: () => data,
  });
  const query = () => {
    const ref = {
      where: () => ref,
      orderBy: () => ref,
      offset: () => ref,
      limit: () => ref,
      get: async () => ({
        docs: [...docs.entries()].map(([id, d]) => snapshot(id, d)),
      }),
      doc: (id: string) => ({
        create: async (data: Record<string, unknown>) => {
          if (docs.has(id)) throw new Error("ALREADY_EXISTS");
          docs.set(id, store(data));
        },
        set: async (data: Record<string, unknown>) =>
          void docs.set(id, store(data)),
        update: async () => {},
        delete: async () => void docs.delete(id),
        get: async () => {
          const data = docs.get(id);
          return data
            ? snapshot(id, data)
            : { id, exists: false, data: () => undefined };
        },
      }),
    };
    return ref;
  };
  return { db: { collection: query } as never };
}

const keysOf = (record: object | null) =>
  record ? Object.keys(record).sort() : [];

describe("adapter read-shape parity", () => {
  let pg: PostgresDataAdapter;
  let fs: DataAdapter;
  let client: PGlite;

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
    pg = new PostgresDataAdapter({
      db: drizzle(client, { schema: { projects } }) as never,
      schema: { projects } as never,
    });
  }, 60000);

  beforeEach(async () => {
    await client.exec("DELETE FROM projects;");
    fs = new FirestoreDataAdapter(firestoreStub());
  });

  const write = async (adapter: DataAdapter) =>
    adapter.createWithId("projects", "one", { title: "One", order: 0 });

  it("neither adapter adds `collection` to a record it reads", async () => {
    await write(pg);
    await write(fs);

    expect(await pg.fetchById("projects", "one")).not.toHaveProperty(
      "collection",
    );
    expect(await fs.fetchById("projects", "one")).not.toHaveProperty(
      "collection",
    );
  });

  it("both address the record by the same id", async () => {
    await write(pg);
    await write(fs);

    expect((await pg.fetchById("projects", "one"))?.id).toBe("one");
    expect((await fs.fetchById("projects", "one"))?.id).toBe("one");
  });

  it("both return null for a missing id", async () => {
    expect(await pg.fetchById("projects", "ghost")).toBeNull();
    expect(await fs.fetchById("projects", "ghost")).toBeNull();
  });

  it("fetchById and fetchCollection agree within each adapter", async () => {
    await write(pg);
    await write(fs);

    for (const adapter of [pg, fs]) {
      const one = await adapter.fetchById("projects", "one");
      const [first] = await adapter.fetchCollection("projects");
      expect(keysOf(first ?? null)).toEqual(keysOf(one));
    }
  });

  it("the two adapters read back the same field names", async () => {
    await write(pg);
    await write(fs);

    const pgKeys = keysOf(await pg.fetchById("projects", "one"));
    const fsKeys = keysOf(await fs.fetchById("projects", "one"));

    expect(fsKeys).toEqual(pgKeys);
    expect(pgKeys).toEqual(["createdAt", "id", "order", "title", "updatedAt"]);
  });

  it("accepts back the record it just returned, on both backends", async () => {
    // An adapter that cannot be handed its own output is not round-trippable,
    // and copying one environment into another does exactly that.
    for (const adapter of [pg, fs]) {
      await write(adapter);
      const row = await adapter.fetchById("projects", "one");
      await adapter.delete("projects", "one");
      await expect(
        adapter.createWithId("projects", "one", row as object),
      ).resolves.toBeTruthy();
    }
  });

  it("both represent a timestamp the same way, as an ISO string", async () => {
    await write(pg);
    await write(fs);

    for (const adapter of [pg, fs]) {
      const row = await adapter.fetchById("projects", "one");
      const createdAt = (row as Record<string, unknown>).createdAt;
      // Not a Date on either side: these records are JSON-serialized across
      // the content route and SSR payloads, where a Date becomes a string.
      expect(typeof createdAt).toBe("string");
      expect(new Date(createdAt as string).toString()).not.toBe("Invalid Date");
    }
  });
});
