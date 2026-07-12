import { describe, expect, it } from "vitest";
import { inMemoryTransport } from "../src/core/transport";

describe("inMemoryTransport", () => {
  it("round-trips save and get", async () => {
    const t = inMemoryTransport();
    await t.save("posts", "a1", { id: "a1", title: "hello" });
    expect(t.get("posts", "a1")).toEqual({ id: "a1", title: "hello" });
  });

  it("seeds initial data with copies", async () => {
    const seed = { posts: [{ id: "a1", title: "seeded" }] };
    const t = inMemoryTransport(seed);
    await t.patch("posts", "a1", { title: "changed" });
    expect(t.get("posts", "a1")?.title).toBe("changed");
    expect(seed.posts[0]?.title).toBe("seeded");
  });

  it("patches merge into the existing item", async () => {
    const t = inMemoryTransport({ posts: [{ id: "a1", title: "x", views: 1 }] });
    await t.patch("posts", "a1", { views: 2 });
    expect(t.get("posts", "a1")).toEqual({ id: "a1", title: "x", views: 2 });
  });

  it("throws when patching a missing item", async () => {
    const t = inMemoryTransport();
    await expect(t.patch("posts", "nope", {})).rejects.toThrow(
      "Cannot patch missing item posts/nope",
    );
  });

  it("removes items", async () => {
    const t = inMemoryTransport({ posts: [{ id: "a1" }] });
    await t.remove("posts", "a1");
    expect(t.get("posts", "a1")).toBeUndefined();
    expect(t.list("posts")).toEqual([]);
  });
});
