import type { CmsEngine, CmsSnapshot, Item } from "better-content/core";

type Subscriber<T> = (value: T) => void;
type Unsubscriber = () => void;

export interface Readable<T> {
  subscribe(run: Subscriber<T>): Unsubscriber;
}

export function engineStore(engine: CmsEngine): Readable<CmsSnapshot> {
  return {
    subscribe(run) {
      run(engine.getSnapshot());
      return engine.subscribe(() => run(engine.getSnapshot()));
    },
  };
}

export function itemStore(
  engine: CmsEngine,
  collection: string,
  id: string,
): Readable<Item | undefined> {
  return {
    subscribe(run) {
      let current = engine.getItem(collection, id);
      run(current);
      return engine.subscribe(() => {
        const next = engine.getItem(collection, id);
        if (!Object.is(next, current)) {
          current = next;
          run(next);
        }
      });
    },
  };
}

export interface ContentEditParams {
  engine: CmsEngine;
  collection: string;
  itemId: string;
  fieldKey: string;
  editing: boolean;
}

export interface ContentEditAction {
  update(params: ContentEditParams): void;
  destroy(): void;
}

function readText(el: HTMLElement): string {
  return typeof el.innerText === "string"
    ? el.innerText
    : (el.textContent ?? "");
}

export function contentEdit(
  node: HTMLElement,
  params: ContentEditParams,
): ContentEditAction {
  let current = params;
  let focused = false;
  let unsubscribe: Unsubscriber | null = null;

  const value = () => {
    const item = current.engine.getItem(current.collection, current.itemId);
    const raw = item?.[current.fieldKey];
    return typeof raw === "string" ? raw : "";
  };

  const render = () => {
    if (!focused) node.textContent = value();
  };

  const apply = () => {
    node.style.whiteSpace = "pre-wrap";
    node.setAttribute("data-cms-editable", "");
    if (current.editing) {
      node.setAttribute("contenteditable", "true");
      node.setAttribute("data-cms-editing", "");
    } else {
      node.removeAttribute("contenteditable");
      node.removeAttribute("data-cms-editing");
    }
  };

  const onFocus = () => {
    if (!current.editing) return;
    focused = true;
    node.setAttribute("data-cms-focused", "");
  };

  const onBlur = () => {
    if (!focused) return;
    focused = false;
    node.removeAttribute("data-cms-focused");
    const next = readText(node);
    if (next !== value()) {
      current.engine.editField(
        current.collection,
        current.itemId,
        current.fieldKey,
        next,
      );
    }
    render();
  };

  const subscribe = () => {
    unsubscribe?.();
    unsubscribe = current.engine.subscribe(render);
  };

  node.addEventListener("focus", onFocus);
  node.addEventListener("blur", onBlur);
  apply();
  render();
  subscribe();

  return {
    update(next: ContentEditParams) {
      const engineChanged = next.engine !== current.engine;
      current = next;
      apply();
      if (engineChanged) subscribe();
      render();
    },
    destroy() {
      unsubscribe?.();
      node.removeEventListener("focus", onFocus);
      node.removeEventListener("blur", onBlur);
    },
  };
}
