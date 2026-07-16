import { onScopeDispose, shallowRef, type ShallowRef } from "vue";
import type { CmsEngine, CmsSnapshot, Item } from "better-content/core";

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

export function useCmsItem(
  engine: CmsEngine,
  collection: string,
  id: string,
): Readonly<ShallowRef<Item | undefined>> {
  const item = shallowRef(engine.getItem(collection, id));
  const stop = engine.subscribe(() => {
    const next = engine.getItem(collection, id);
    if (!Object.is(next, item.value)) {
      item.value = next;
    }
  });
  onScopeDispose(stop);
  return item;
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
