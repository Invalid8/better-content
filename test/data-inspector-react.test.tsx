// @vitest-environment jsdom
import { act, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DataInspector } from "../src/devtools/react";
import { DATA_INSPECTOR_TAG, type DataInspectorElement } from "../src/devtools";
import { createCmsEngine, inMemoryTransport } from "../src/core";
import type { DataAdapter } from "../src/core";

const flush = () => act(() => new Promise((r) => setTimeout(r, 0)));

const fakeAdapter = (data: Record<string, Record<string, unknown>[]>) =>
  ({
    fetchCollection: vi.fn(async (c: string) => data[c] ?? []),
  }) as unknown as DataAdapter;

describe("DataInspector (React wrapper)", () => {
  it("mounts the element and wires adapter and collections as properties", async () => {
    const adapter = fakeAdapter({
      posts: [{ id: "a1", title: "From the wrapper" }],
    });
    const { container } = render(
      <DataInspector adapter={adapter} collections={["posts"]} />,
    );
    await flush();

    const el = container.querySelector(
      DATA_INSPECTOR_TAG,
    ) as DataInspectorElement;
    expect(el).toBeTruthy();
    expect(el.shadowRoot!.textContent).toContain("From the wrapper");
  });

  it("refreshes through a wired engine after saves", async () => {
    const adapter = fakeAdapter({ posts: [] });
    const engine = createCmsEngine({
      transport: inMemoryTransport(),
      notify: { success: () => {}, error: () => {} },
    });
    render(
      <DataInspector adapter={adapter} engine={engine} collections={["posts"]} />,
    );
    await flush();
    const before = (adapter.fetchCollection as ReturnType<typeof vi.fn>).mock
      .calls.length;

    engine.editField("posts", "a1", "title", "x");
    await act(() => engine.saveAll());
    await flush();

    expect(
      (adapter.fetchCollection as ReturnType<typeof vi.fn>).mock.calls.length,
    ).toBeGreaterThan(before);
  });
});
