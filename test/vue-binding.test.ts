// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { effectScope } from "vue";
import {
  useCmsItem,
  useCmsSnapshot,
  useEditableImage,
  vContentEdit,
  type ContentEditBinding,
} from "../src/vue/index";
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

describe("useCmsSnapshot", () => {
  it("tracks snapshots and stops on scope dispose", () => {
    const engine = makeEngine();
    const scope = effectScope();
    const snapshot = scope.run(() => useCmsSnapshot(engine))!;

    expect(snapshot.value.hasUnsavedChanges).toBe(false);
    engine.editField("sections", "hero", "heading", "Changed");
    expect(snapshot.value.hasUnsavedChanges).toBe(true);

    const seen = snapshot.value;
    scope.stop();
    engine.editField("sections", "hero", "heading", "Again");
    expect(snapshot.value).toBe(seen);
  });
});

describe("useCmsItem", () => {
  it("updates only when the addressed item changes", () => {
    const engine = makeEngine();
    const scope = effectScope();
    const item = scope.run(() => useCmsItem(engine, "posts", "b"))!;
    const before = item.value;

    engine.editField("posts", "a", "title", "Alpha 2");
    expect(item.value).toBe(before);

    engine.editField("posts", "b", "title", "Beta 2");
    expect(item.value).toMatchObject({ title: "Beta 2" });
    scope.stop();
  });
});

describe("vContentEdit directive", () => {
  const mount = (editing: boolean) => {
    const engine = makeEngine();
    const el = document.createElement("p");
    document.body.appendChild(el);
    const binding: ContentEditBinding = {
      engine,
      collection: "sections",
      itemId: "hero",
      fieldKey: "heading",
      editing,
    };
    vContentEdit.mounted(el as never, { value: binding });
    return { engine, el, binding };
  };

  it("renders the value and applies edit attributes", () => {
    const { el } = mount(true);
    expect(el.textContent).toBe("Hello");
    expect(el.getAttribute("contenteditable")).toBe("true");
    expect(el.hasAttribute("data-cms-editable")).toBe(true);
    vContentEdit.unmounted(el as never);
    el.remove();
  });

  it("commits on blur through editField", () => {
    const { engine, el } = mount(true);
    el.dispatchEvent(new FocusEvent("focus"));
    el.textContent = "Edited in Vue";
    el.dispatchEvent(new FocusEvent("blur"));

    expect(engine.getItem("sections", "hero")?.heading).toBe("Edited in Vue");
    vContentEdit.unmounted(el as never);
    el.remove();
  });

  it("follows engine changes and honors updated bindings", () => {
    const { engine, el, binding } = mount(false);
    engine.editField("sections", "hero", "heading", "From outside");
    expect(el.textContent).toBe("From outside");

    vContentEdit.updated(el as never, {
      value: { ...binding, editing: true },
    });
    expect(el.getAttribute("contenteditable")).toBe("true");

    vContentEdit.unmounted(el as never);
    engine.editField("sections", "hero", "heading", "Silent");
    expect(el.textContent).toBe("From outside");
    el.remove();
  });
});

describe("useEditableImage", () => {
  it("exposes reactive state and queues uploads through the engine", () => {
    const engine = makeEngine();
    const scope = effectScope();
    const api = scope.run(() =>
      useEditableImage(engine, {
        collection: "sections",
        itemId: "hero",
        fieldKey: "cover",
      }),
    )!;

    expect(api.src.value).toBe("");
    engine.editField("sections", "hero", "cover", "https://a.test/pic.png");
    expect(api.src.value).toBe("https://a.test/pic.png");

    const urls = URL as unknown as { createObjectURL: ((b: Blob) => string) | undefined };
    const original = urls.createObjectURL;
    urls.createObjectURL = () => "blob:preview";
    try {
      api.selectFile(new File(["x"], "pic.png", { type: "image/png" }));
    } finally {
      urls.createObjectURL = original;
    }

    expect(api.src.value).toBe("blob:preview");
    expect(engine.getSnapshot().pendingImages).toMatchObject([
      { fieldKey: "cover", localUrl: "blob:preview", isExternal: false },
    ]);
    scope.stop();
  });

  it("validates external URLs and tracks hasError", () => {
    const engine = makeEngine();
    const scope = effectScope();
    const api = scope.run(() =>
      useEditableImage(engine, {
        collection: "sections",
        itemId: "hero",
        fieldKey: "cover",
      }),
    )!;

    expect(api.setExternalUrl("nope")).toBe(false);
    expect(engine.getSnapshot().pendingImages).toHaveLength(0);

    api.handleError();
    expect(api.hasError.value).toBe(true);

    expect(api.setExternalUrl("https://b.test/pic.png")).toBe(true);
    expect(api.hasError.value).toBe(false);
    expect(engine.getSnapshot().pendingImages[0]).toMatchObject({
      file: null,
      isExternal: true,
    });
    scope.stop();
  });
});
