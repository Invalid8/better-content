import { onScopeDispose, shallowRef, type ShallowRef } from "vue";
import type { CmsEngine, CmsSnapshot, Item } from "better-content/core";
import {
  openImageFilePicker,
  readImageView,
  selectImageFile,
  setExternalImageUrl,
} from "../shared/image-edit";
import { createMarkdownEditor } from "../shared/markdown-edit";

export function useCmsSnapshot(
  engine: CmsEngine,
): Readonly<ShallowRef<CmsSnapshot>> {
  const snapshot = shallowRef(engine.getSnapshot());
  const stop = engine.subscribe(() => {
    snapshot.value = engine.getSnapshot();
  });
  onScopeDispose(stop);
  return snapshot;
}

export function useCmsItem<T = Record<string, unknown>>(
  engine: CmsEngine,
  collection: string,
  id: string,
): Readonly<ShallowRef<Item<T> | undefined>> {
  // Annotated rather than `shallowRef<Item<T> | undefined>(...)`: Vue's
  // shallowRef returns a conditional type that cannot resolve while T is
  // still generic, and the unresolved union is not assignable to ShallowRef.
  const item: ShallowRef<Item<T> | undefined> = shallowRef(
    engine.getItem<T>(collection, id),
  );
  const stop = engine.subscribe(() => {
    const next = engine.getItem<T>(collection, id);
    if (!Object.is(next, item.value)) {
      item.value = next;
    }
  });
  onScopeDispose(stop);
  return item;
}

export interface EditableImageOptions {
  collection: string;
  itemId: string;
  fieldKey: string;
  accept?: string;
}

export interface EditableImageApi {
  src: Readonly<ShallowRef<string>>;
  saving: Readonly<ShallowRef<boolean>>;
  hasError: Readonly<ShallowRef<boolean>>;
  openFilePicker(): void;
  selectFile(file: File): void;
  setExternalUrl(url: string): boolean;
  handleError(): void;
}

export function useEditableImage(
  engine: CmsEngine,
  options: EditableImageOptions,
): EditableImageApi {
  const target = { engine, ...options };
  const view = readImageView(target);
  const src = shallowRef(view.src);
  const saving = shallowRef(view.saving);
  const hasError = shallowRef(false);

  const sync = () => {
    const next = readImageView(target);
    src.value = next.src;
    saving.value = next.saving;
  };
  const stop = engine.subscribe(sync);
  onScopeDispose(stop);

  return {
    src,
    saving,
    hasError,
    openFilePicker() {
      openImageFilePicker(target, (file) => {
        hasError.value = false;
        selectImageFile(target, file);
      });
    },
    selectFile(file) {
      hasError.value = false;
      selectImageFile(target, file);
    },
    setExternalUrl(url) {
      const accepted = setExternalImageUrl(target, url);
      if (accepted) hasError.value = false;
      return accepted;
    },
    handleError() {
      hasError.value = true;
    },
  };
}

export interface ContentEditBinding {
  engine: CmsEngine;
  collection: string;
  itemId: string;
  fieldKey: string;
  editing: boolean;
}

interface ContentEditState {
  binding: ContentEditBinding;
  focused: boolean;
  stop: () => void;
  onFocus: () => void;
  onBlur: () => void;
}

const STATE = Symbol("better-content-edit");

type EditHost = HTMLElement & { [STATE]?: ContentEditState };

function readText(el: HTMLElement): string {
  return typeof el.innerText === "string"
    ? el.innerText
    : (el.textContent ?? "");
}

function value(binding: ContentEditBinding): string {
  const item = binding.engine.getItem(binding.collection, binding.itemId);
  const raw = item?.[binding.fieldKey];
  return typeof raw === "string" ? raw : "";
}

function render(el: EditHost) {
  const state = el[STATE];
  if (state && !state.focused) el.textContent = value(state.binding);
}

function apply(el: EditHost) {
  const state = el[STATE];
  if (!state) return;
  el.style.whiteSpace = "pre-wrap";
  el.setAttribute("data-cms-editable", "");
  if (state.binding.editing) {
    el.setAttribute("contenteditable", "true");
    el.setAttribute("data-cms-editing", "");
  } else {
    el.removeAttribute("contenteditable");
    el.removeAttribute("data-cms-editing");
  }
}

export const vContentEdit = {
  mounted(el: EditHost, { value: binding }: { value: ContentEditBinding }) {
    const state: ContentEditState = {
      binding,
      focused: false,
      stop: binding.engine.subscribe(() => render(el)),
      onFocus() {
        if (!state.binding.editing) return;
        state.focused = true;
        el.setAttribute("data-cms-focused", "");
      },
      onBlur() {
        if (!state.focused) return;
        state.focused = false;
        el.removeAttribute("data-cms-focused");
        const next = readText(el);
        if (next !== value(state.binding)) {
          state.binding.engine.editField(
            state.binding.collection,
            state.binding.itemId,
            state.binding.fieldKey,
            next,
          );
        }
        render(el);
      },
    };
    el[STATE] = state;
    el.addEventListener("focus", state.onFocus);
    el.addEventListener("blur", state.onBlur);
    apply(el);
    render(el);
  },

  updated(el: EditHost, { value: binding }: { value: ContentEditBinding }) {
    const state = el[STATE];
    if (!state) return;
    const engineChanged = binding.engine !== state.binding.engine;
    state.binding = binding;
    apply(el);
    if (engineChanged) {
      state.stop();
      state.stop = binding.engine.subscribe(() => render(el));
    }
    render(el);
  },

  unmounted(el: EditHost) {
    const state = el[STATE];
    if (!state) return;
    state.stop();
    el.removeEventListener("focus", state.onFocus);
    el.removeEventListener("blur", state.onBlur);
    delete el[STATE];
  },
};

export interface MarkdownEditorOptions {
  initialValue: string;
  onSave: (content: string) => void | Promise<void>;
}

export interface MarkdownEditorApi {
  value: Readonly<ShallowRef<string>>;
  charCount: Readonly<ShallowRef<number>>;
  textareaRef: ShallowRef<HTMLTextAreaElement | null>;
  setValue(next: string): void;
  insert(before: string, after?: string, placeholder?: string): void;
  reset(to?: string): void;
  save(): void | Promise<void>;
}

export function useMarkdownEditor(
  options: MarkdownEditorOptions,
): MarkdownEditorApi {
  const textareaRef = shallowRef<HTMLTextAreaElement | null>(null);
  const controller = createMarkdownEditor({
    ...options,
    getTextarea: () => textareaRef.value,
  });

  const initial = controller.getSnapshot();
  const value = shallowRef(initial.value);
  const charCount = shallowRef(initial.charCount);

  const stop = controller.subscribe(() => {
    const next = controller.getSnapshot();
    value.value = next.value;
    charCount.value = next.charCount;
  });
  onScopeDispose(stop);

  return {
    value,
    charCount,
    textareaRef,
    setValue: controller.setValue,
    insert: controller.insert,
    reset: controller.reset,
    save: controller.save,
  };
}
