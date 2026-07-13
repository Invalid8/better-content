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
