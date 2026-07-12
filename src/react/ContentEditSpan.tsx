"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ElementType,
  type ReactNode,
} from "react";
import { getPath } from "better-content/core";
import { usePageContext } from "./usePageContext";
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

export function ContentEditSpan({
  collection,
  itemId,
  fieldKey,
  className,
  children,
  as = "span",
  renderValue = defaultRenderValue,
}: ContentEditSpanProps) {
  const { getItem, editField } = usePageContext();
  const { isEditing } = useCmsAuth();

  const item = getItem(collection, itemId);
  const raw =
    (getPath(item, fieldKey) as string) ??
    (typeof children === "string" ? children : "");

  const Component = as;

  if (!isEditing) {
    return <Component className={className}>{renderValue(raw)}</Component>;
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
  const rawRef = useRef(raw);

  useEffect(() => {
    if (!isFocused && rawRef.current !== raw) {
      rawRef.current = raw;
    }
  }, [raw, isFocused]);

  useEffect(() => {
    if (!isFocused && rawRef.current !== editValue) {
      setEditValue(rawRef.current);
    }
  }, [isFocused, editValue]);

  const handleInput = useCallback(() => {
    if (contentRef.current) {
      setEditValue(contentRef.current.textContent || "");
    }
  }, []);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    if (editValue !== raw) {
      editField(collection, itemId, fieldKey, editValue);
    }
  }, [editValue, raw, collection, itemId, fieldKey, editField]);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    if (contentRef.current) {
      contentRef.current.textContent = editValue;
      setTimeout(() => {
        if (contentRef.current) {
          const range = document.createRange();
          const sel = window.getSelection();
          range.selectNodeContents(contentRef.current);
          range.collapse(false);
          sel?.removeAllRanges();
          sel?.addRange(range);
        }
      }, 0);
    }
  }, [editValue]);

  return (
    <Component
      key={isFocused ? "editing" : "static"}
      ref={contentRef}
      className={className}
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
