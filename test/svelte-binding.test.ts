// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import {
  contentEdit,
  engineStore,
  itemStore,
} from "../src/svelte/index";
import { createCmsEngine, inMemoryTransport } from "../src/core";
import type { Notifier } from "../src/core";

const silent: Notifier = { success: () => {}, error: () => {} };

const makeEngine = () =>
  createCmsEngine({
    transport: inMemoryTransport(),
    notify: silent,
    initialItems: {
      sections: [{ id: "hero", heading: "Hello" }],
      posts: [
        { id: "a", title: "Alpha" },
        { id: "b", title: "Beta" },
      ],
    },
  });

describe("engineStore", () => {
  it("calls the subscriber immediately with the current snapshot", () => {
    const engine = makeEngine();
    const run = vi.fn();
    const stop = engineStore(engine).subscribe(run);

    expect(run).toHaveBeenCalledTimes(1);
    expect(run.mock.calls[0]![0].hasUnsavedChanges).toBe(false);
    stop();
  });

  it("pushes new snapshots on change and stops after unsubscribe", () => {
    const engine = makeEngine();
    const run = vi.fn();
    const stop = engineStore(engine).subscribe(run);

    engine.editField("sections", "hero", "heading", "Changed");
    expect(run).toHaveBeenCalledTimes(2);
    expect(run.mock.calls[1]![0].hasUnsavedChanges).toBe(true);

    stop();
    engine.editField("sections", "hero", "heading", "Again");
    expect(run).toHaveBeenCalledTimes(2);
  });
});

describe("itemStore", () => {
  it("emits only when the addressed item changes", () => {
    const engine = makeEngine();
    const run = vi.fn();
    const stop = itemStore(engine, "posts", "b").subscribe(run);
    expect(run).toHaveBeenCalledTimes(1);

    engine.editField("posts", "a", "title", "Alpha 2");
    expect(run).toHaveBeenCalledTimes(1);

    engine.editField("posts", "b", "title", "Beta 2");
    expect(run).toHaveBeenCalledTimes(2);
    expect(run.mock.calls[1]![0]).toMatchObject({ title: "Beta 2" });
    stop();
  });
});

describe("contentEdit action", () => {
  const mount = (editing: boolean) => {
    const engine = makeEngine();
    const node = document.createElement("h1");
    document.body.appendChild(node);
    const action = contentEdit(node, {
      engine,
      collection: "sections",
      itemId: "hero",
      fieldKey: "heading",
      editing,
    });
    return { engine, node, action };
  };

  it("renders the field value and marks the element editable", () => {
    const { node, action } = mount(true);
    expect(node.textContent).toBe("Hello");
    expect(node.getAttribute("contenteditable")).toBe("true");
    expect(node.hasAttribute("data-cms-editable")).toBe(true);
    expect(node.style.whiteSpace).toBe("pre-wrap");
    action.destroy();
    node.remove();
  });

  it("commits the draft on blur through editField", () => {
    const { engine, node, action } = mount(true);
    node.dispatchEvent(new FocusEvent("focus"));
    expect(node.hasAttribute("data-cms-focused")).toBe(true);

    node.textContent = "Edited inline";
    node.dispatchEvent(new FocusEvent("blur"));

    expect(engine.getItem("sections", "hero")?.heading).toBe("Edited inline");
    expect(engine.getSnapshot().hasUnsavedChanges).toBe(true);
    expect(node.hasAttribute("data-cms-focused")).toBe(false);
    action.destroy();
    node.remove();
  });

  it("re-renders when the engine changes the field elsewhere", () => {
    const { engine, node, action } = mount(false);
    engine.editField("sections", "hero", "heading", "From outside");
    expect(node.textContent).toBe("From outside");
    action.destroy();
    node.remove();
  });

  it("does not enter edit state when editing is off, and updates via params", () => {
    const { engine, node, action } = mount(false);
    expect(node.getAttribute("contenteditable")).toBeNull();

    node.dispatchEvent(new FocusEvent("focus"));
    expect(node.hasAttribute("data-cms-focused")).toBe(false);

    action.update({
      engine,
      collection: "sections",
      itemId: "hero",
      fieldKey: "heading",
      editing: true,
    });
    expect(node.getAttribute("contenteditable")).toBe("true");
    action.destroy();
    node.remove();
  });

  it("stops listening after destroy", () => {
    const { engine, node, action } = mount(false);
    action.destroy();
    engine.editField("sections", "hero", "heading", "Silent");
    expect(node.textContent).toBe("Hello");
    node.remove();
  });
});
