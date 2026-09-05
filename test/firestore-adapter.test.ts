import { describe, expect, it } from "vitest";
import { FirestoreDataAdapter } from "../src/adapters/firestore";

function stubDb() {
  const calls = {
    where: [] as unknown[][],
    orderBy: [] as unknown[][],
    offset: [] as unknown[][],
    limit: [] as unknown[][],
  };
  const ref = {
    where: (...a: unknown[]) => (calls.where.push(a), ref),
    orderBy: (...a: unknown[]) => (calls.orderBy.push(a), ref),
    offset: (...a: unknown[]) => (calls.offset.push(a), ref),
    limit: (...a: unknown[]) => (calls.limit.push(a), ref),
    get: async () => ({ docs: [] }),
  };
  const db = { collection: () => ref };
  return { db: db as never, calls };
}

describe("FirestoreDataAdapter — Query mapping", () => {
  it("maps comparison + membership ops onto Firestore operators", async () => {
    const { db, calls } = stubDb();
    const adapter = new FirestoreDataAdapter({ db });

    await adapter.fetchCollection("posts", {
      filters: [
        { field: "status", op: "eq", value: "live" },
        { field: "views", op: "gte", value: 10 },
        { field: "tag", op: "in", value: ["a", "b"] },
        { field: "tag", op: "nin", value: ["c"] },
      ],
    });

    expect(calls.where).toEqual([
      ["status", "==", "live"],
      ["views", ">=", 10],
      ["tag", "in", ["a", "b"]],
      ["tag", "not-in", ["c"]],
    ]);
  });

  it("applies orderBy, offset and limit", async () => {
    const { db, calls } = stubDb();
    const adapter = new FirestoreDataAdapter({ db });

    await adapter.fetchCollection("posts", {
      orderBy: [{ field: "createdAt", direction: "asc" }],
      offset: 5,
      limit: 20,
    });

    expect(calls.orderBy).toContainEqual(["createdAt", "asc"]);
    expect(calls.offset).toEqual([[5]]);
    expect(calls.limit).toEqual([[20]]);
  });

  it("defaults to ordering by createdAt desc when no query is given", async () => {
    const { db, calls } = stubDb();
    const adapter = new FirestoreDataAdapter({ db });

    await adapter.fetchCollection("posts");

    expect(calls.orderBy).toEqual([["createdAt", "desc"]]);
  });

  it("throws on the `contains` op (no native substring search)", async () => {
    const { db } = stubDb();
    const adapter = new FirestoreDataAdapter({ db });

    await expect(
      adapter.fetchCollection("posts", {
        filters: [{ field: "title", op: "contains", value: "hi" }],
      }),
    ).rejects.toThrowError(/contains|substring|does not support/i);
  });

  it("throws on OR filter groups", async () => {
    const { db } = stubDb();
    const adapter = new FirestoreDataAdapter({ db });

    await expect(
      adapter.fetchCollection("posts", {
        filters: [{ or: [{ field: "tag", op: "eq", value: "x" }] }],
      }),
    ).rejects.toThrowError(/OR filter groups/i);
  });
});

// A stub that records writes, so the write contract can be asserted without
// a live Firestore.
function writeStubDb(existing: string[] = []) {
  const writes: { op: string; id: string; keys: string[] }[] = [];
  const has = new Set(existing);
  const docRef = (id: string) => ({
    create: async (data: Record<string, unknown>) => {
      // Firestore's own `create` rejects when the document exists.
      if (has.has(id)) throw new Error(`ALREADY_EXISTS: ${id}`);
      has.add(id);
      writes.push({ op: "create", id, keys: Object.keys(data) });
    },
    set: async (data: Record<string, unknown>) => {
      has.add(id);
      writes.push({ op: "set", id, keys: Object.keys(data) });
    },
    update: async (data: Record<string, unknown>) => {
      writes.push({ op: "update", id, keys: Object.keys(data) });
    },
    delete: async () => {
      has.delete(id);
      writes.push({ op: "delete", id, keys: [] });
    },
  });
  const db = { collection: () => ({ doc: docRef }) };
  return { db: db as never, writes };
}

describe("FirestoreDataAdapter — write contract", () => {
  it("createWithId rejects an id that already exists", async () => {
    const { db } = writeStubDb(["taken"]);
    const adapter = new FirestoreDataAdapter({ db });

    await expect(
      adapter.createWithId("posts", "taken", { title: "clobber" }),
    ).rejects.toThrowError(/ALREADY_EXISTS/);
  });

  it("createWithId issues `create`, never `set`, so it cannot overwrite", async () => {
    const { db, writes } = writeStubDb();
    const adapter = new FirestoreDataAdapter({ db });

    await adapter.createWithId("posts", "fresh", { title: "A" });

    expect(writes.map((w) => w.op)).toEqual(["create"]);
    expect(writes.flatMap((w) => w.keys)).toEqual(
      expect.arrayContaining(["createdAt", "updatedAt"]),
    );
  });

  it("upsert writes regardless, and does not stamp createdAt", async () => {
    const { db, writes } = writeStubDb(["taken"]);
    const adapter = new FirestoreDataAdapter({ db });

    await adapter.upsert("posts", "taken", { title: "B" });

    expect(writes.map((w) => w.op)).toEqual(["set"]);
    expect(writes.flatMap((w) => w.keys)).not.toContain("createdAt");
  });

  it("delete succeeds for an id that does not exist", async () => {
    const { db, writes } = writeStubDb();
    const adapter = new FirestoreDataAdapter({ db });

    await expect(adapter.delete("posts", "ghost")).resolves.toBeUndefined();
    expect(writes.map((w) => w.op)).toEqual(["delete"]);
  });

  it("delete then createWithId is the portable document replace", async () => {
    const { db, writes } = writeStubDb(["hero"]);
    const adapter = new FirestoreDataAdapter({ db });

    await adapter.delete("page", "hero");
    await adapter.createWithId("page", "hero", { title: "Replaced" });

    expect(writes.map((w) => w.op)).toEqual(["delete", "create"]);
    expect(writes.flatMap((w) => w.keys)).toContain("createdAt");
  });
});
