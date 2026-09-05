// Framework-free markdown-draft logic shared by the React, Vue and Svelte
// bindings. Unlike image-edit, the draft is not engine state, so this module
// holds it behind the same getSnapshot/subscribe contract the engine uses.
//
// The element is read through `getTextarea` rather than owned, because React
// hands the textarea to the consumer via a ref the consumer assigns.

export interface MarkdownEditorState {
  value: string;
  charCount: number;
}

export interface CreateMarkdownEditorOptions {
  initialValue: string;
  onSave: (content: string) => void | Promise<void>;
  /**
   * Reads the attached textarea, if there is one. Returning `null` is not an
   * error: `insert` then falls back to appending at the end of the value.
   */
  getTextarea?: () => HTMLTextAreaElement | null;
}

export interface MarkdownEditorController {
  getSnapshot(): MarkdownEditorState;
  subscribe(listener: () => void): () => void;
  setValue(next: string): void;
  insert(before: string, after?: string, placeholder?: string): void;
  reset(to?: string): void;
  save(): void | Promise<void>;
}

export function createMarkdownEditor(
  options: CreateMarkdownEditorOptions,
): MarkdownEditorController {
  const { initialValue, onSave, getTextarea } = options;

  let value = initialValue;
  let snapshot: MarkdownEditorState = { value, charCount: value.length };

  const listeners = new Set<() => void>();

  const set = (next: string) => {
    if (next === value) return;
    value = next;
    snapshot = { value, charCount: value.length };
    for (const listener of listeners) listener();
  };

  return {
    getSnapshot: () => snapshot,

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    setValue: set,

    insert(before, after = "", placeholder = "text") {
      const textarea = getTextarea?.() ?? null;
      const start = textarea?.selectionStart ?? value.length;
      const end = textarea?.selectionEnd ?? value.length;
      const selected = value.substring(start, end) || placeholder;

      set(
        value.substring(0, start) +
          before +
          selected +
          after +
          value.substring(end),
      );

      // Deferred by a macrotask so it runs after the binding has written the
      // new value: React commits, Vue and Svelte flush in a microtask, and a
      // write to .value would otherwise reset the selection to the end.
      setTimeout(() => {
        if (!textarea) return;
        textarea.focus();
        const caret = start + before.length + selected.length;
        textarea.setSelectionRange(caret, caret);
      }, 0);
    },

    reset(to = initialValue) {
      set(to);
    },

    save() {
      return onSave(value);
    },
  };
}
