import { describe, expect, it } from "vitest";
import { dirtyKey, setPath } from "../src/core/helpers";

describe("dirtyKey", () => {
  it("joins collection and id", () => {
    expect(dirtyKey("posts", "a1")).toBe("posts:a1");
  });
});

describe("setPath", () => {
  it("sets a top-level key immutably", () => {
    const obj = { title: "old", body: "text" };
    const next = setPath(obj, "title", "new");
    expect(next).toEqual({ title: "new", body: "text" });
    expect(obj.title).toBe("old");
  });

  it("sets a nested dotted path", () => {
    const obj = { hero: { heading: "old", sub: "keep" } };
    const next = setPath(obj, "hero.heading", "new") as typeof obj;
    expect(next.hero).toEqual({ heading: "new", sub: "keep" });
    expect(obj.hero.heading).toBe("old");
  });

  it("creates intermediate objects when missing", () => {
    const next = setPath({}, "a.b.c", 1);
    expect(next).toEqual({ a: { b: { c: 1 } } });
  });

  it("does not share nested references with the source", () => {
    const obj = { a: { b: { c: 1 } } };
    const next = setPath(obj, "a.b.c", 2) as typeof obj;
    expect(next.a).not.toBe(obj.a);
    expect(next.a.b).not.toBe(obj.a.b);
    expect(obj.a.b.c).toBe(1);
  });
});
