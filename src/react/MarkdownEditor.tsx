"use client";

import { useCallback, useRef, useState, type RefObject } from "react";

export interface UseMarkdownEditorOptions {
  initialValue: string;
  onSave: (content: string) => void | Promise<void>;
}

export interface MarkdownEditorApi {
  value: string;
  setValue: (next: string) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  insert: (before: string, after?: string, placeholder?: string) => void;
  reset: (to?: string) => void;
  save: () => void | Promise<void>;
  charCount: number;
}

export function useMarkdownEditor({
  initialValue,
  onSave,
}: UseMarkdownEditorOptions): MarkdownEditorApi {
  const [value, setValue] = useState(initialValue);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insert = useCallback(
    (before: string, after = "", placeholder = "text") => {
      const textarea = textareaRef.current;
      const start = textarea?.selectionStart ?? value.length;
      const end = textarea?.selectionEnd ?? value.length;
      const selected = value.substring(start, end) || placeholder;
      const next =
        value.substring(0, start) +
        before +
        selected +
        after +
        value.substring(end);

      setValue(next);

      setTimeout(() => {
        if (!textarea) return;
        textarea.focus();
        const caret = start + before.length + selected.length;
        textarea.setSelectionRange(caret, caret);
      }, 0);
    },
    [value],
  );

  const reset = useCallback(
    (to: string = initialValue) => setValue(to),
    [initialValue],
  );

  const save = useCallback(() => onSave(value), [onSave, value]);

  return {
    value,
    setValue,
    textareaRef,
    insert,
    reset,
    save,
    charCount: value.length,
  };
}
