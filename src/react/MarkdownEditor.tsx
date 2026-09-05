"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type RefObject,
} from "react";
import { createMarkdownEditor } from "../shared/markdown-edit";

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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // `onSave` is usually an inline arrow, so the controller must call the
  // latest one or a save would run against stale props.
  const onSaveRef = useRef(onSave);
  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  const [controller] = useState(() =>
    createMarkdownEditor({
      initialValue,
      onSave: (content) => onSaveRef.current(content),
      getTextarea: () => textareaRef.current,
    }),
  );

  const { value, charCount } = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );

  return {
    value,
    charCount,
    setValue: controller.setValue,
    textareaRef,
    insert: controller.insert,
    reset: controller.reset,
    save: controller.save,
  };
}
