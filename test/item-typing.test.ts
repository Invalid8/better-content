// The `expectTypeOf` assertions here are erased at runtime, so `npm test`
// alone proves nothing about them. `npm run typecheck` is what enforces them:
// tsconfig includes `test`, and a mismatch is a compile error.
import { describe, expect, expectTypeOf, it } from "vitest";
import { createCmsEngine, inMemoryTransport, type Item } from "../src/core";
import type { Notifier } from "../src/core";
import { useCmsItem as reactUseCmsItem } from "../src/react/hooks";
import { useCmsItem as vueUseCmsItem } from "../src/vue/index";
import { itemStore, type Readable } from "../src/svelte/index";
import type { ShallowRef } from "vue";

const silent: Notifier = { success: () => {}, error: () => {} };

// The shapes that forced the portfolio migration into a cast: a `portfolio`
// collection of heterogeneous singletons, addressed by id.
type Skill = { key: string; value: string; skillLevel: number };
type Banner = { headline: string; skills: Skill[] };

const makeEngine = () =>
  createCmsEngine({
    transport: inMemoryTransport(),
    notify: silent,
    initialItems: {
      portfolio: [
        {
          id: "banner",
          headline: "Hello",
          skills: [{ key: "ts", value: "TypeScript", skillLevel: 5 }],
        },
      ],
    },
  });

describe("Item<T>", () => {
  it("still means Record<string, unknown> & { id } with no argument", () => {
    expectTypeOf<Item>().toEqualTypeOf<Record<string, unknown> & { id: string }>();
  });

  it("carries the id alongside the supplied shape", () => {
    expectTypeOf<Item<Banner>>().toEqualTypeOf<Banner & { id: string }>();
    expectTypeOf<Item<Banner>>().toHaveProperty("id").toEqualTypeOf<string>();
  });
});

describe("the write path", () => {
  // `interface` has no implicit index signature, so it fails a
  // `T extends Record<string, unknown>` constraint. The constraint is
  // `object` precisely so consumers can use their own interfaces.
  interface Project {
    title: string;
    order: number;
  }

  it("checks a created record against the named shape", async () => {
    const engine = makeEngine();
    const id = await engine.createItem<Project>("projects", {
      title: "Portfolio",
      order: 0,
    });
    expect(engine.getItem<Project>("projects", id)?.title).toBe("Portfolio");
  });

  it("checks a patch as a partial of the named shape", async () => {
    const engine = makeEngine();
    const id = await engine.createItem<Project>("projects", {
      title: "Portfolio",
      order: 0,
    });
    await engine.updateItem<Project>("projects", id, { order: 3 });
    expect(engine.getItem<Project>("projects", id)?.order).toBe(3);
  });

  it("still accepts an untyped payload, as before", async () => {
    const engine = makeEngine();
    const id = await engine.createItem("projects", { anything: true });
    expect(engine.getItem("projects", id)?.anything).toBe(true);
  });
});

describe("getItem", () => {
  it("reads fields as unknown when no type is supplied, as before", () => {
    const engine = makeEngine();
    const section = engine.getItem("portfolio", "banner");
    expectTypeOf(section).toEqualTypeOf<Item | undefined>();
    expectTypeOf(section?.skills).toEqualTypeOf<unknown>();
  });

  it("reads fields at their real types when one is", () => {
    const engine = makeEngine();
    // This is the portfolio's call site. `?.skills` was `unknown` and would
    // not assign to `Skill[]`, which is what the shim's cast worked around.
    const banner = engine.getItem<Banner>("portfolio", "banner");
    expectTypeOf(banner).toEqualTypeOf<Item<Banner> | undefined>();
    expectTypeOf(banner?.skills).toEqualTypeOf<Skill[] | undefined>();

    const skills: Skill[] = banner?.skills ?? [];
    expect(skills.map((s) => s.value)).toEqual(["TypeScript"]);
    expect(banner?.id).toBe("banner");
  });

  it("returns undefined for a missing id whatever the type says", () => {
    const engine = makeEngine();
    const missing = engine.getItem<Banner>("portfolio", "nope");
    expect(missing).toBeUndefined();
  });

  it("does not verify T at runtime, which is the documented trade", () => {
    const engine = makeEngine();
    // `banner` has no `tagline`. The type says otherwise and nothing throws;
    // this is the same unchecked assertion DataAdapter.fetchCollection<T>
    // has always made, pinned here so the trade stays deliberate.
    const wrong = engine.getItem<{ tagline: string }>("portfolio", "banner");
    expectTypeOf(wrong?.tagline).toEqualTypeOf<string | undefined>();
    expect(wrong?.tagline).toBeUndefined();
  });
});

describe("the bindings carry the parameter through", () => {
  type Banner2 = { headline: string; skills: Skill[] };

  it("react useCmsItem", () => {
    expectTypeOf(reactUseCmsItem<Banner2>).returns.toEqualTypeOf<
      Item<Banner2> | undefined
    >();
    // `.returns` on an uninstantiated generic is `never`, so name the default.
    expectTypeOf(
      reactUseCmsItem<Record<string, unknown>>,
    ).returns.toEqualTypeOf<Item | undefined>();
  });

  it("vue useCmsItem", () => {
    expectTypeOf(vueUseCmsItem<Banner2>).returns.toEqualTypeOf<
      Readonly<ShallowRef<Item<Banner2> | undefined>>
    >();
  });

  it("svelte itemStore", () => {
    expectTypeOf(itemStore<Banner2>).returns.toEqualTypeOf<
      Readable<Item<Banner2> | undefined>
    >();
  });
});
