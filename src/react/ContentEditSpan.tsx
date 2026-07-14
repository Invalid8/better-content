"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ElementType,
  type ReactNode,
} from "react";
import { getPath } from "better-content/core";
import { useCmsEngine, useCmsItem } from "./hooks";
import { useCmsAuth } from "./auth";

export interface ContentEditSpanProps {
  collection: string;
  itemId: string;
  fieldKey: string;
  className?: string;
  children?: ReactNode;
  as?: ElementType;
  renderValue?: (raw: string) => ReactNode;
}

const defaultRenderValue = (raw: string): ReactNode => raw;

const preWrap = { whiteSpace: "pre-wrap" } as const;

function readText(el: HTMLElement): string {
  return typeof el.innerText === "string"
    ? el.innerText
    : (el.textContent ?? "");
}

export function ContentEditSpan({
  collection,
  itemId,
  fieldKey,
  className,
  children,
  as = "span",
  renderValue = defaultRenderValue,
}: ContentEditSpanProps) {
  const { editField } = useCmsEngine();
  const { isEditing } = useCmsAuth();

  const item = useCmsItem(collection, itemId);
  const raw =
    (getPath(item, fieldKey) as string) ??
    (typeof children === "string" ? children : "");

  const Component = as;

  if (!isEditing) {
    return (
      <Component className={className} style={preWrap}>
        {renderValue(raw)}
      </Component>
    );
  }

  return (
    <EditableContentSpan
      collection={collection}
      itemId={itemId}
      fieldKey={fieldKey}
      className={className}
      raw={raw}
      editField={editField}
      as={as}
      renderValue={renderValue}
    />
  );
}

function EditableContentSpan({
  collection,
  itemId,
  fieldKey,
  className,
  raw,
  editField,
  as: Component = "span",
  renderValue,
}: {
  collection: string;
  itemId: string;
  fieldKey: string;
  className?: string | undefined;
  raw: string;
  editField: (
    collection: string,
    itemId: string,
    fieldKey: string,
    value: string,
  ) => void;
  as?: ElementType;
  renderValue: (raw: string) => ReactNode;
}) {
  const { isEditing } = useCmsAuth();
  const [isFocused, setIsFocused] = useState(false);
  const [editValue, setEditValue] = useState(raw);
  const contentRef = useRef<HTMLElement>(null);
  const draftRef = useRef(raw);

  useEffect(() => {
    if (!isFocused && editValue !== raw) {
      setEditValue(raw);
      draftRef.current = raw;
    }
  }, [raw, isFocused, editValue]);

  useLayoutEffect(() => {
    if (!isFocused || !contentRef.current) return;
    contentRef.current.textContent = draftRef.current;

    const range = document.createRange();
    const sel = window.getSelection();
    range.selectNodeContents(contentRef.current);
    range.collapse(false);
    sel?.removeAllRanges();
    sel?.addRange(range);
  }, [isFocused]);

  const handleInput = useCallback(() => {
    if (contentRef.current) {
      draftRef.current = readText(contentRef.current);
    }
  }, []);

  const handleBlur = useCallback(() => {
    const next = contentRef.current
      ? readText(contentRef.current)
      : draftRef.current;
    draftRef.current = next;
    setEditValue(next);
    setIsFocused(false);
    if (next !== raw) {
      editField(collection, itemId, fieldKey, next);
    }
  }, [raw, collection, itemId, fieldKey, editField]);

  const handleFocus = useCallback(() => {
    draftRef.current = editValue;
    setIsFocused(true);
  }, [editValue]);

  return (
    <Component
      ref={contentRef}
      className={className}
      style={preWrap}
      data-cms-editable=""
      data-cms-editing={isEditing ? "" : undefined}
      data-cms-focused={isFocused ? "" : undefined}
      contentEditable={isEditing}
      suppressContentEditableWarning
      onInput={handleInput}
      onBlur={handleBlur}
      onFocus={handleFocus}
    >
      {!isFocused && renderValue(editValue)}
    </Component>
  );
}
