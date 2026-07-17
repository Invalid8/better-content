import type { CmsEngine } from "better-content/core";

// Framework-free image-edit logic shared by the Vue and Svelte bindings.
// Mirrors the behavior of the React EditableImage primitive: picking a file
// previews it via an object URL and queues a pending upload that the engine
// flushes on save; external URLs are validated and queued without a file.

export interface ImageEditTarget {
  engine: CmsEngine;
  collection: string;
  itemId: string;
  fieldKey: string;
  accept?: string;
}

export interface ImageEditView {
  src: string;
  saving: boolean;
}

export function readImageView(target: ImageEditTarget): ImageEditView {
  const { engine, collection, itemId, fieldKey } = target;
  const snapshot = engine.getSnapshot();
  const pending = snapshot.pendingImages.find(
    (image) =>
      image.collection === collection &&
      image.itemId === itemId &&
      image.fieldKey === fieldKey,
  );
  const stored = engine.getItem(collection, itemId)?.[fieldKey];
  return {
    src: pending?.localUrl ?? (typeof stored === "string" ? stored : ""),
    saving: snapshot.saving,
  };
}

export function selectImageFile(target: ImageEditTarget, file: File): void {
  const { engine, collection, itemId, fieldKey } = target;
  const localUrl = URL.createObjectURL(file);
  engine.editField(collection, itemId, fieldKey, localUrl);
  engine.setPendingImage({
    file,
    localUrl,
    collection,
    itemId,
    fieldKey,
    isExternal: false,
  });
}

export function setExternalImageUrl(
  target: ImageEditTarget,
  value: string,
): boolean {
  let valid = false;
  try {
    const url = new URL(value);
    valid = url.protocol === "http:" || url.protocol === "https:";
  } catch {
    valid = false;
  }
  if (!valid) return false;

  const { engine, collection, itemId, fieldKey } = target;
  engine.editField(collection, itemId, fieldKey, value);
  engine.setPendingImage({
    file: null,
    localUrl: value,
    collection,
    itemId,
    fieldKey,
    isExternal: true,
  });
  return true;
}

export function openImageFilePicker(
  target: ImageEditTarget,
  onFile: (file: File) => void,
): void {
  if (typeof document === "undefined") return;
  if (target.engine.getSnapshot().saving) return;

  const input = document.createElement("input");
  input.type = "file";
  input.accept = target.accept ?? "image/*";
  input.addEventListener("change", () => {
    const file = input.files?.[0];
    if (file) onFile(file);
  });
  input.click();
}
