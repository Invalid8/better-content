// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useMarkdownEditor } from "../src/react/MarkdownEditor";

describe("useMarkdownEditor", () => {
  it("tracks value and charCount", () => {
    const { result } = renderHook(() =>
      useMarkdownEditor({ initialValue: "hello", onSave: () => {} }),
    );
    expect(result.current.value).toBe("hello");
    expect(result.current.charCount).toBe(5);

    act(() => result.current.setValue("hello world"));
    expect(result.current.value).toBe("hello world");
    expect(result.current.charCount).toBe(11);
  });

  it("insert wraps with a placeholder at the end when no textarea is attached", () => {
    const { result } = renderHook(() =>
      useMarkdownEditor({ initialValue: "hello", onSave: () => {} }),
    );
    act(() => result.current.insert("**", "**", "bold"));
    expect(result.current.value).toBe("hello**bold**");
  });

  it("insert wraps the current textarea selection and restores the caret", async () => {
    const textarea = document.createElement("textarea");
    document.body.appendChild(textarea);

    const { result } = renderHook(() =>
      useMarkdownEditor({ initialValue: "hello world", onSave: () => {} }),
    );
    textarea.value = "hello world";
    result.current.textareaRef.current = textarea;
    textarea.setSelectionRange(0, 5);

    act(() => result.current.insert("_", "_"));
    expect(result.current.value).toBe("_hello_ world");

    await act(() => new Promise((r) => setTimeout(r, 5)));
    expect(textarea.selectionStart).toBe(6);
    textarea.remove();
  });

  it("save passes the current value to onSave", () => {
    const onSave = vi.fn();
    const { result } = renderHook(() =>
      useMarkdownEditor({ initialValue: "draft", onSave }),
    );
    act(() => result.current.setValue("final"));
    act(() => void result.current.save());
    expect(onSave).toHaveBeenCalledWith("final");
  });

  it("reset returns to the initial value or an explicit one", () => {
    const { result } = renderHook(() =>
      useMarkdownEditor({ initialValue: "start", onSave: () => {} }),
    );
    act(() => result.current.setValue("changed"));
    act(() => result.current.reset());
    expect(result.current.value).toBe("start");

    act(() => result.current.reset("other"));
    expect(result.current.value).toBe("other");
  });
});
