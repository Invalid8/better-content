// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { createMarkdownEditor } from "../src/shared/markdown-edit";

const attached = (value: string, start: number, end = start) => {
  const textarea = document.createElement("textarea");
  document.body.appendChild(textarea);
  textarea.value = value;
  textarea.setSelectionRange(start, end);
  return textarea;
};

describe("createMarkdownEditor", () => {
  it("starts at the initial value and tracks charCount", () => {
    const editor = createMarkdownEditor({
      initialValue: "hello",
      onSave: () => {},
    });
    expect(editor.getSnapshot()).toEqual({ value: "hello", charCount: 5 });

    editor.setValue("hello world");
    expect(editor.getSnapshot()).toEqual({ value: "hello world", charCount: 11 });
  });

  it("keeps the snapshot reference stable until the value changes", () => {
    const editor = createMarkdownEditor({
      initialValue: "hello",
      onSave: () => {},
    });
    const first = editor.getSnapshot();

    editor.setValue("hello");
    expect(editor.getSnapshot()).toBe(first);

    editor.setValue("changed");
    expect(editor.getSnapshot()).not.toBe(first);
  });

  it("notifies subscribers on change, and stops after unsubscribing", () => {
    const editor = createMarkdownEditor({
      initialValue: "a",
      onSave: () => {},
    });
    const listener = vi.fn();
    const unsubscribe = editor.subscribe(listener);

    editor.setValue("b");
    expect(listener).toHaveBeenCalledTimes(1);

    editor.setValue("b");
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    editor.setValue("c");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  describe("insert", () => {
    it("appends with the placeholder when no textarea is attached", () => {
      const editor = createMarkdownEditor({
        initialValue: "hello",
        onSave: () => {},
      });
      editor.insert("**", "**", "bold");
      expect(editor.getSnapshot().value).toBe("hello**bold**");
    });

    it("appends when getTextarea returns null", () => {
      const editor = createMarkdownEditor({
        initialValue: "hello",
        onSave: () => {},
        getTextarea: () => null,
      });
      editor.insert("_", "_");
      expect(editor.getSnapshot().value).toBe("hello_text_");
    });

    it("wraps the attached selection rather than the placeholder", () => {
      const textarea = attached("hello world", 0, 5);
      const editor = createMarkdownEditor({
        initialValue: "hello world",
        onSave: () => {},
        getTextarea: () => textarea,
      });

      editor.insert("_", "_", "unused");
      expect(editor.getSnapshot().value).toBe("_hello_ world");
      textarea.remove();
    });

    it("inserts the placeholder at a collapsed caret", () => {
      const textarea = attached("hello world", 5);
      const editor = createMarkdownEditor({
        initialValue: "hello world",
        onSave: () => {},
        getTextarea: () => textarea,
      });

      editor.insert("[", "](url)", "link");
      expect(editor.getSnapshot().value).toBe("hello[link](url) world");
      textarea.remove();
    });

    it("restores the caret after a DOM write scheduled in a microtask", async () => {
      // Stands in for the Svelte binding, whose compiler this package does
      // not carry. The Vue equivalent runs against a real mount in
      // test/vue-binding.test.ts.
      const textarea = attached("hello world", 0, 5);
      const editor = createMarkdownEditor({
        initialValue: "hello world",
        onSave: () => {},
        getTextarea: () => textarea,
      });
      editor.subscribe(() => {
        queueMicrotask(() => {
          textarea.value = editor.getSnapshot().value;
        });
      });

      editor.insert("**", "**");
      await new Promise((resolve) => setTimeout(resolve, 5));

      expect(textarea.value).toBe("**hello** world");
      expect(textarea.selectionStart).toBe("**hello".length);
      textarea.remove();
    });

    it("leaves the caret after the wrapped text and before the closing marker", async () => {
      const textarea = attached("hello world", 0, 5);
      const editor = createMarkdownEditor({
        initialValue: "hello world",
        onSave: () => {},
        getTextarea: () => textarea,
      });

      editor.insert("**", "**");
      // The binding is what writes the new value to the DOM.
      textarea.value = editor.getSnapshot().value;

      await new Promise((resolve) => setTimeout(resolve, 5));
      expect(textarea.selectionStart).toBe("**hello".length);
      expect(textarea.selectionEnd).toBe("**hello".length);
      textarea.remove();
    });
  });

  describe("reset", () => {
    it("returns to the construction-time value", () => {
      const editor = createMarkdownEditor({
        initialValue: "start",
        onSave: () => {},
      });
      editor.setValue("changed");
      editor.reset();
      expect(editor.getSnapshot().value).toBe("start");
    });

    it("returns to an explicit value when given one", () => {
      const editor = createMarkdownEditor({
        initialValue: "start",
        onSave: () => {},
      });
      editor.reset("other");
      expect(editor.getSnapshot().value).toBe("other");
    });
  });

  describe("save", () => {
    it("passes the current value to onSave", () => {
      const onSave = vi.fn();
      const editor = createMarkdownEditor({ initialValue: "draft", onSave });
      editor.setValue("final");
      editor.save();
      expect(onSave).toHaveBeenCalledWith("final");
    });

    it("propagates a rejection from onSave rather than swallowing it", async () => {
      const editor = createMarkdownEditor({
        initialValue: "draft",
        onSave: () => Promise.reject(new Error("offline")),
      });
      await expect(editor.save()).rejects.toThrow("offline");
    });
  });
});
