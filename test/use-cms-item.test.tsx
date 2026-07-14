// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { CmsEngine } from "../src/core";
import { inMemoryTransport } from "../src/core/transport";
import {
  AnonymousEditProvider,
  PageProvider,
  useCmsEngine,
  useCmsItem,
} from "../src/react/index";

function Capture({ onEngine }: { onEngine: (engine: CmsEngine) => void }) {
  onEngine(useCmsEngine());
  return null;
}

function Probe({
  id,
  renders,
}: {
  id: string;
  renders: Record<string, number>;
}) {
  renders[id] = (renders[id] ?? 0) + 1;
  const item = useCmsItem("posts", id);
  return <output data-testid={id}>{String(item?.title ?? "none")}</output>;
}

const seeded = {
  posts: [
    { id: "a", title: "Alpha" },
    { id: "b", title: "Beta" },
  ],
};

function setup() {
  const renders: Record<string, number> = {};
  let engine!: CmsEngine;
  render(
    <AnonymousEditProvider>
      <PageProvider transport={inMemoryTransport()} initialItems={seeded}>
        <Capture onEngine={(e) => (engine = e)} />
        <Probe id="a" renders={renders} />
        <Probe id="b" renders={renders} />
      </PageProvider>
    </AnonymousEditProvider>,
  );
  return { renders, engine };
}

describe("useCmsItem", () => {
  it("returns the addressed item and tracks its edits", () => {
    const { engine } = setup();
    expect(screen.getByTestId("a").textContent).toBe("Alpha");

    act(() => engine.editField("posts", "a", "title", "Alpha 2"));
    expect(screen.getByTestId("a").textContent).toBe("Alpha 2");
  });

  it("re-renders only the subscriber of the edited item", () => {
    const { renders, engine } = setup();
    const before = { ...renders };

    act(() => engine.editField("posts", "a", "title", "Alpha 2"));

    expect(renders.a).toBeGreaterThan(before.a!);
    expect(renders.b).toBe(before.b);
  });

  it("returns undefined for a missing item until it is created", () => {
    let engine!: CmsEngine;
    render(
      <AnonymousEditProvider>
        <PageProvider transport={inMemoryTransport()}>
          <Capture onEngine={(e) => (engine = e)} />
          <Probe id="ghost" renders={{}} />
        </PageProvider>
      </AnonymousEditProvider>,
    );
    expect(screen.getByTestId("ghost").textContent).toBe("none");

    act(() => engine.editField("posts", "ghost", "title", "Now exists"));
    expect(screen.getByTestId("ghost").textContent).toBe("Now exists");
  });

  it("useCmsEngine throws outside the provider", () => {
    const Naked = () => {
      useCmsEngine();
      return null;
    };
    expect(() => render(<Naked />)).toThrow(
      "useCmsEngine must be used within a PageProvider",
    );
  });
});
