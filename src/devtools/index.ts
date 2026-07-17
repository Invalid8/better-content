import type { CmsEngine, DataAdapter, Item } from "better-content/core";

export interface DataInspectorElement extends HTMLElement {
  adapter: DataAdapter | null;
  engine: CmsEngine | null;
  collections: string[];
  refresh(): Promise<void>;
}

const STYLES = `
:host {
  --bc-bg: #14181e;
  --bc-ink: #c9d2dd;
  --bc-accent: #ffe24a;
  --bc-dim: #6d7681;
  --bc-line: #262d36;
  --bc-col: #7ea1d4;
  font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  font-size: 13px;
}
.fab {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 2147483000;
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--bc-bg);
  color: var(--bc-ink);
  border: none;
  border-radius: 999px;
  padding: 10px 18px;
  font: inherit;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(20, 24, 30, 0.25), 0 8px 24px rgba(20, 24, 30, 0.18);
}
.fab .count { color: var(--bc-col); }
dialog {
  border: none;
  border-radius: 0;
  padding: 0;
  width: min(58rem, calc(100vw - 2rem));
  max-height: min(80vh, 40rem);
  background: var(--bc-bg);
  color: var(--bc-ink);
  font: inherit;
}
dialog[open] {
  display: flex;
  flex-direction: column;
}
dialog.expanded {
  width: calc(100vw - 2rem);
  height: calc(100vh - 2rem);
  max-height: calc(100vh - 2rem);
}
dialog::backdrop { background: rgba(20, 24, 30, 0.45); }
.head {
  display: flex;
  align-items: center;
  gap: 16px;
  flex: 0 0 auto;
  padding: 12px 24px;
  border-bottom: 1px solid var(--bc-line);
}
.head .title { color: var(--bc-accent); font-weight: 500; }
.head .count { color: var(--bc-col); }
.head-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
}
.close,
.expand {
  background: none;
  border: 1px solid var(--bc-line);
  border-radius: 6px;
  color: var(--bc-ink);
  font: inherit;
  padding: 3px 10px;
  cursor: pointer;
}
.close:hover,
.expand:hover { border-color: var(--bc-ink); }
.tables {
  display: grid;
  grid-template-columns: 1fr;
  gap: 20px;
  flex: 1 1 auto;
  min-height: 0;
  padding: 16px 24px 20px;
  overflow-y: auto;
}
table { width: 100%; border-collapse: collapse; }
caption {
  text-align: left;
  color: var(--bc-accent);
  padding-bottom: 6px;
  font-weight: 500;
}
th, td {
  text-align: left;
  padding: 4px 12px 4px 0;
  border-bottom: 1px solid var(--bc-line);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 16rem;
  font-weight: 400;
}
th { color: var(--bc-col); font-size: 12px; }
.hint {
  flex: 0 0 auto;
  padding: 0 24px 20px;
  margin: 0;
  color: var(--bc-dim);
  font-size: 12px;
}
`;

function truncate(value: unknown): string {
  if (value == null) return "∅";
  const s = String(value);
  return s.length > 42 ? `${s.slice(0, 39)}…` : s;
}

export const DATA_INSPECTOR_TAG = "better-content-inspector";

export function registerDataInspector(
  tagName: string = DATA_INSPECTOR_TAG,
): void {
  if (typeof window === "undefined" || typeof customElements === "undefined") {
    return;
  }
  if (customElements.get(tagName)) return;

  class DataInspector extends HTMLElement implements DataInspectorElement {
    static observedAttributes = ["collections"];

    #adapter: DataAdapter | null = null;
    #engine: CmsEngine | null = null;
    #collections: string[] = [];
    #tables = new Map<string, Item[]>();
    #unsubscribe: (() => void) | null = null;
    #dialog: HTMLDialogElement;
    #fabCount: HTMLElement;
    #headCount: HTMLElement;
    #tablesBox: HTMLElement;
    #expandButton: HTMLButtonElement;
    #scrollRestore: { html: string; body: string } | null = null;

    constructor() {
      super();
      const root = this.attachShadow({ mode: "open" });
      const style = document.createElement("style");
      style.textContent = STYLES;

      const fab = document.createElement("button");
      fab.className = "fab";
      fab.innerHTML = `▤ your database <span class="count"></span>`;
      fab.addEventListener("click", () => this.#open());

      this.#dialog = document.createElement("dialog");
      this.#dialog.setAttribute("aria-label", "Your database");
      this.#dialog.innerHTML = `
        <div class="head">
          <span class="title">▤ your database</span>
          <span class="count"></span>
          <span class="head-actions">
            <button class="expand" type="button" aria-pressed="false">Full page</button>
            <button class="close" type="button" aria-label="Close">✕</button>
          </span>
        </div>
        <div class="tables"></div>
        <p class="hint">Live rows read through the DataAdapter. Only mount this element in development.</p>
      `;
      this.#dialog.addEventListener("click", (e) => {
        if (e.target === this.#dialog) this.#close();
      });
      this.#dialog.addEventListener("close", () => this.#setPageScrollLocked(false));
      this.#dialog
        .querySelector(".close")!
        .addEventListener("click", () => this.#close());
      this.#expandButton = this.#dialog.querySelector(".expand")!;
      this.#expandButton.addEventListener("click", () => this.#toggleExpanded());

      root.append(style, fab, this.#dialog);
      this.#fabCount = fab.querySelector(".count")!;
      this.#headCount = this.#dialog.querySelector(".head .count")!;
      this.#tablesBox = this.#dialog.querySelector(".tables")!;
    }

    get adapter(): DataAdapter | null {
      return this.#adapter;
    }

    set adapter(value: DataAdapter | null) {
      this.#adapter = value;
      void this.refresh();
    }

    get engine(): CmsEngine | null {
      return this.#engine;
    }

    set engine(value: CmsEngine | null) {
      this.#unsubscribe?.();
      this.#unsubscribe = null;
      this.#engine = value;
      if (value) {
        this.#unsubscribe = value.subscribe(() => {
          if (!value.getSnapshot().saving) void this.refresh();
        });
      }
    }

    get collections(): string[] {
      return this.#collections;
    }

    set collections(value: string[]) {
      this.#collections = value;
      void this.refresh();
    }

    attributeChangedCallback(name: string, _old: string, next: string) {
      if (name === "collections") {
        this.#collections = (next ?? "")
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean);
        void this.refresh();
      }
    }

    disconnectedCallback() {
      this.#unsubscribe?.();
      this.#unsubscribe = null;
      this.#setPageScrollLocked(false);
    }

    async refresh(): Promise<void> {
      const adapter = this.#adapter;
      if (!adapter || !this.#collections.length) return;
      const entries = await Promise.all(
        this.#collections.map(
          async (name) =>
            [name, (await adapter.fetchCollection(name)) as Item[]] as const,
        ),
      );
      this.#tables = new Map(entries);
      this.#render();
    }

    #open() {
      void this.refresh();
      if (typeof this.#dialog.showModal === "function") {
        this.#dialog.showModal();
      } else {
        this.#dialog.setAttribute("open", "");
      }
      this.#syncPageScrollLock();
    }

    #close() {
      if (typeof this.#dialog.close === "function") {
        this.#dialog.close();
      } else {
        this.#dialog.removeAttribute("open");
      }
      this.#setPageScrollLocked(false);
    }

    #toggleExpanded() {
      const expanded = !this.#dialog.classList.contains("expanded");
      this.#dialog.classList.toggle("expanded", expanded);
      this.#expandButton.textContent = expanded ? "Default size" : "Full page";
      this.#expandButton.setAttribute("aria-pressed", String(expanded));
      this.#syncPageScrollLock();
    }

    #syncPageScrollLock() {
      this.#setPageScrollLocked(
        this.#dialog.open && this.#dialog.classList.contains("expanded"),
      );
    }

    #setPageScrollLocked(locked: boolean) {
      const root = document.documentElement;
      const body = document.body;
      if (locked) {
        if (this.#scrollRestore) return;
        this.#scrollRestore = {
          html: root.style.overflow,
          body: body.style.overflow,
        };
        root.style.overflow = "hidden";
        body.style.overflow = "hidden";
        return;
      }

      if (!this.#scrollRestore) return;
      root.style.overflow = this.#scrollRestore.html;
      body.style.overflow = this.#scrollRestore.body;
      this.#scrollRestore = null;
    }

    #render() {
      let total = 0;
      const counts: string[] = [];
      this.#tablesBox.textContent = "";

      for (const [name, rows] of this.#tables) {
        total += rows.length;
        counts.push(`${name}: ${rows.length}`);

        const table = document.createElement("table");
        const caption = document.createElement("caption");
        caption.textContent = name;
        table.append(caption);

        const columns = rows.length
          ? Object.keys(rows[0]!).filter((c) => c !== "collection")
          : ["id"];

        const thead = document.createElement("thead");
        const headRow = document.createElement("tr");
        for (const c of columns) {
          const th = document.createElement("th");
          th.textContent = c;
          headRow.append(th);
        }
        thead.append(headRow);

        const tbody = document.createElement("tbody");
        for (const row of rows) {
          const tr = document.createElement("tr");
          for (const c of columns) {
            const td = document.createElement("td");
            td.textContent = truncate(row[c]);
            tr.append(td);
          }
          tbody.append(tr);
        }

        table.append(thead, tbody);
        this.#tablesBox.append(table);
      }

      this.#fabCount.textContent = `${total} rows`;
      this.#headCount.textContent = counts.join(" · ");
    }
  }

  customElements.define(tagName, DataInspector);
}
