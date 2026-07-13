"use client";

import { useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { useCmsAuth } from "./auth";
import { usePageContext } from "./usePageContext";

export interface EditableImageRenderState {
  src: string;
  isEditing: boolean;
  saving: boolean;
  hasError: boolean;
  openFilePicker: () => void;
  setExternalUrl: (url: string) => boolean;
  imgProps: { src: string; onError: () => void };
}

export interface EditableImageProps {
  collection: string;
  itemId: string;
  fieldKey: string;
  src: string;
  className?: string;
  children?: (state: EditableImageRenderState) => ReactNode;
}

export function EditableImage({
  collection,
  itemId,
  fieldKey,
  src,
  className,
  children,
}: EditableImageProps) {
  const { isEditing } = useCmsAuth();
  const { editField, setPendingImage, pendingImages, saving } =
    usePageContext();

  const [preview, setPreview] = useState(src);
  const [hasError, setHasError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const pendingImage = pendingImages.find(
    (img) =>
      img.collection === collection &&
      img.itemId === itemId &&
      img.fieldKey === fieldKey,
  );
  const imgSrc = pendingImage?.localUrl || preview;

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (saving) return;
    const file = e.target.files?.[0];
    if (!file) return;

    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);
    setHasError(false);

    editField(collection, itemId, fieldKey, localUrl);
    setPendingImage({
      file,
      localUrl,
      collection,
      itemId,
      fieldKey,
      isExternal: false,
    });
  };

  const openFilePicker = () => {
    if (saving) return;
    inputRef.current?.click();
  };

  const setExternalUrl = (value: string): boolean => {
    let valid = false;
    try {
      const url = new URL(value);
      valid = url.protocol === "http:" || url.protocol === "https:";
    } catch {
      valid = false;
    }
    if (!valid) return false;

    setPreview(value);
    setHasError(false);
    editField(collection, itemId, fieldKey, value);
    setPendingImage({
      file: null,
      localUrl: value,
      collection,
      itemId,
      fieldKey,
      isExternal: true,
    });
    return true;
  };

  const state: EditableImageRenderState = {
    src: imgSrc,
    isEditing,
    saving,
    hasError,
    openFilePicker,
    setExternalUrl,
    imgProps: { src: imgSrc, onError: () => setHasError(true) },
  };

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        disabled={saving}
        onChange={handleFileChange}
        style={{ display: "none" }}
      />
      {children ? children(state) : <img {...state.imgProps} alt="" />}
    </div>
  );
}
