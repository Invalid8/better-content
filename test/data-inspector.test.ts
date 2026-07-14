// @vitest-environment jsdom
import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  DATA_INSPECTOR_TAG,
  registerDataInspector,
  type DataInspectorElement,
} from "../src/devtools";
import { createCmsEngine, inMemoryTransport } from "../src/core";
import type { DataAdapter } from "../src/core";

const fakeAdapter = (data: Record<string, Record<string, unknown>[]>) =>
  ({
    fetchCollection: vi.fn(async (collection: string) => data[collection] ?? []),
  }) as unknown as DataAdapter;

const flush = () => new Promise((r) => setTimeout(r, 0));

const mount = (): DataInspectorElement => {
  const el = document.createElement(DATA_INSPECTOR_TAG) as DataInspectorElement;
  document.body.appendChild(el);
  return el;
};

beforeAll(() => {
  registerDataInspector();
});

describe("registerDataInspector", () => {
  it("is idempotent", () => {
    expect(() => registerDataInspector()).not.toThrow();
    expect(customElements.get(DATA_INSPECTOR_TAG)).toBeDefined();
  });
});

describe("DataInspector element", () => {
  it("renders rows from the adapter into shadow DOM", async () => {
    const el = mount();
    el.collections = ["posts"];
    el.adapter = fakeAdapter({
      posts: [{ id: "a1", title: "Hello inspector" }],
    });
    await flush();

    const shadow = el.shadowRoot!;
    expect(shadow.querySelector("caption")?.textContent).toBe("posts");
    expect(shadow.textContent).toContain("Hello inspector");
    expect(shadow.querySelector(".fab")?.textContent).toContain("1 rows");
    el.remove();
  });

  it("reads collections from the attribute", async () => {
    const el = mount();
    el.setAttribute("collections", "posts, sections");
    el.adapter = fakeAdapter({ posts: [{ id: "a" }], sections: [{ id: "s" }] });
    await flush();

    const captions = [...el.shadowRoot!.querySelectorAll("caption")].map(
      (c) => c.textContent,
    );
    expect(captions).toEqual(["posts", "sections"]);
    el.remove();
  });

  it("truncates long values", async () => {
    const el = mount();
    el.collections = ["posts"];
    el.adapter = fakeAdapter({
      posts: [{ id: "a1", body: "x".repeat(100) }],
    });
    await flush();

    const cell = [...el.shadowRoot!.querySelectorAll("td")].find((td) =>
      td.textContent?.includes("x"),
    );
    expect(cell?.textContent?.length).toBeLessThanOrEqual(40);
    expect(cell?.textContent?.endsWith("…")).toBe(true);
    el.remove();
  });

  it("refreshes when a connected engine saves", async () => {
    const transport = inMemoryTransport();
    const engine = createCmsEngine({
      transport,
      notify: { success: () => {}, error: () => {} },
    });
    const adapter = fakeAdapter({ posts: [] });

    const el = mount();
    el.collections = ["posts"];
    el.adapter = adapter;
    el.engine = engine;
    await flush();
    const callsBefore = (adapter.fetchCollection as ReturnType<typeof vi.fn>)
      .mock.calls.length;

    engine.editField("posts", "a1", "title", "x");
    await engine.saveAll();
    await flush();

    const callsAfter = (adapter.fetchCollection as ReturnType<typeof vi.fn>)
      .mock.calls.length;
    expect(callsAfter).toBeGreaterThan(callsBefore);
    el.remove();
  });

  it("stops listening to the engine when disconnected", async () => {
    const engine = createCmsEngine({
      transport: inMemoryTransport(),
      notify: { success: () => {}, error: () => {} },
    });
    const adapter = fakeAdapter({ posts: [] });

    const el = mount();
    el.collections = ["posts"];
    el.adapter = adapter;
    el.engine = engine;
    await flush();
    el.remove();

    const calls = (adapter.fetchCollection as ReturnType<typeof vi.fn>).mock
      .calls.length;
    engine.editField("posts", "a1", "title", "x");
    await engine.saveAll();
    await flush();

    expect(
      (adapter.fetchCollection as ReturnType<typeof vi.fn>).mock.calls.length,
    ).toBe(calls);
    el.remove();
  });
});
