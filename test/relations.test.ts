import { describe, expect, it, vi } from "vitest";
import { resolveRelations } from "../src/server/relations";
import type { DataAdapter } from "../src/core/types";

function makeAdapter(store: Record<string, Record<string, unknown>>): {
  adapter: DataAdapter;
  fetchById: ReturnType<typeof vi.fn>;
} {
  const fetchById = vi.fn(async (collection: string, id: string) => {
    return store[`${collection}/${id}`] ?? null;
  });
  const notImpl = () => {
    throw new Error("not implemented");
  };
  const adapter = {
    fetchById,
    fetchCollection: notImpl,
    create: notImpl,
    createWithId: notImpl,
    update: notImpl,
    upsert: notImpl,
    delete: notImpl,
  } as unknown as DataAdapter;
  return { adapter, fetchById };
}

type AnyDoc = Record<string, unknown>;

describe("resolveRelations", () => {
  it("resolves a self-describing { collection, id } ref without a relations map", async () => {
    const { adapter } = makeAdapter({
      "authors/a1": { id: "a1", name: "Ada" },
    });
    const post: AnyDoc = { id: "p1", author: { collection: "authors", id: "a1" } };

    await resolveRelations(adapter, post, { populate: ["author"] });

    expect(post.author).toEqual({ id: "a1", name: "Ada" });
  });

  it("resolves a bare-id ref via the relations config", async () => {
    const { adapter } = makeAdapter({
      "authors/a1": { id: "a1", name: "Ada" },
    });
    const post: AnyDoc = { id: "p1", authorId: "a1" };

    await resolveRelations(adapter, post, {
      populate: ["authorId"],
      relations: { authorId: { collection: "authors" } },
    });

    expect(post.authorId).toEqual({ id: "a1", name: "Ada" });
  });

  it("defaults populate to every field named in relations", async () => {
    const { adapter, fetchById } = makeAdapter({
      "authors/a1": { id: "a1", name: "Ada" },
    });
    const post: AnyDoc = { id: "p1", authorId: "a1" };

    await resolveRelations(adapter, post, {
      relations: { authorId: { collection: "authors" } },
    });

    expect(post.authorId).toEqual({ id: "a1", name: "Ada" });
    expect(fetchById).toHaveBeenCalledOnce();
  });

  it("resolves arrays of refs element-wise", async () => {
    const { adapter } = makeAdapter({
      "tags/t1": { id: "t1", label: "react" },
      "tags/t2": { id: "t2", label: "sql" },
    });
    const post: AnyDoc = {
      id: "p1",
      tags: [
        { collection: "tags", id: "t1" },
        { collection: "tags", id: "t2" },
      ],
    };

    await resolveRelations(adapter, post, { populate: ["tags"] });

    expect(post.tags).toEqual([
      { id: "t1", label: "react" },
      { id: "t2", label: "sql" },
    ]);
  });

  it("deduplicates loads: one fetch per unique (collection, id)", async () => {
    const { adapter, fetchById } = makeAdapter({
      "authors/a1": { id: "a1", name: "Ada" },
    });
    const posts: AnyDoc[] = [
      { id: "p1", author: { collection: "authors", id: "a1" } },
      { id: "p2", author: { collection: "authors", id: "a1" } },
      { id: "p3", author: { collection: "authors", id: "a1" } },
    ];

    await resolveRelations(adapter, posts, { populate: ["author"] });

    expect(fetchById).toHaveBeenCalledTimes(1);
    expect(posts.map((p) => (p.author as AnyDoc).name)).toEqual([
      "Ada",
      "Ada",
      "Ada",
    ]);
  });

  it("leaves an unresolved ref (fetch returns null) untouched", async () => {
    const { adapter } = makeAdapter({});
    const post: AnyDoc = {
      id: "p1",
      author: { collection: "authors", id: "missing" },
    };

    await resolveRelations(adapter, post, { populate: ["author"] });

    expect(post.author).toEqual({ collection: "authors", id: "missing" });
  });

  it("leaves a non-ref field value untouched", async () => {
    const { adapter, fetchById } = makeAdapter({});
    const post: AnyDoc = { id: "p1", title: "hello", count: 3 };

    await resolveRelations(adapter, post, { populate: ["title", "count"] });

    expect(post.title).toBe("hello");
    expect(post.count).toBe(3);
    expect(fetchById).not.toHaveBeenCalled();
  });

  it("short-circuits when there is nothing to populate", async () => {
    const { adapter, fetchById } = makeAdapter({});
    const post: AnyDoc = { id: "p1", author: { collection: "authors", id: "a1" } };

    await resolveRelations(adapter, post, {});

    expect(fetchById).not.toHaveBeenCalled();
  });

  it("returns the same reference shape it was given (single vs array)", async () => {
    const { adapter } = makeAdapter({ "authors/a1": { id: "a1" } });
    const single: AnyDoc = {
      id: "p1",
      author: { collection: "authors", id: "a1" },
    };
    const arr: AnyDoc[] = [single];

    const r1 = await resolveRelations(adapter, single, { populate: ["author"] });
    const r2 = await resolveRelations(adapter, arr, { populate: ["author"] });

    expect(r1).toBe(single);
    expect(r2).toBe(arr);
  });
});
