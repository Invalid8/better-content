import { useEffect, useRef, useState } from "react";
import type { DataAdapter, Item } from "better-content/core";
import { usePageContext } from "better-content/react";

const HIDDEN = new Set(["collection"]);

function truncate(value: unknown): string {
  if (value == null) return "∅";
  const s = String(value);
  return s.length > 42 ? `${s.slice(0, 39)}…` : s;
}

function RowTable({ name, rows }: { name: string; rows: Item[] }) {
  const columns = rows.length
    ? Object.keys(rows[0]!).filter((c) => !HIDDEN.has(c))
    : ["id"];

  return (
    <table>
      <caption>{name}</caption>
      <thead>
        <tr>
          {columns.map((c) => (
            <th key={c}>{c}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            {columns.map((c) => (
              <td key={c}>{truncate(row[c])}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function DataDialog({ adapter }: { adapter: DataAdapter }) {
  const { items, saving } = usePageContext();
  const [open, setOpen] = useState(false);
  const [tables, setTables] = useState<Record<string, Item[]>>({});
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (saving) return;
    let cancelled = false;
    void (async () => {
      const [sections, cards] = await Promise.all([
        adapter.fetchCollection("sections"),
        adapter.fetchCollection("cards", {
          orderBy: [{ field: "order", direction: "asc" }],
        }),
      ]);
      if (!cancelled) setTables({ sections, cards });
    })();
    return () => {
      cancelled = true;
    };
  }, [items, saving]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const totalRows = Object.values(tables).reduce((n, r) => n + r.length, 0);
  const counts = Object.entries(tables)
    .map(([name, rows]) => `${name}: ${rows.length}`)
    .join(" · ");

  return (
    <>
      <button className="db-fab" onClick={() => setOpen(true)}>
        ▤ your database
        <span className="count">{totalRows} rows</span>
      </button>
      <dialog
        ref={ref}
        className="db-dialog"
        aria-label="Your database"
        onClose={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === ref.current) setOpen(false);
        }}
      >
        <div className="db-head">
          <span>▤ your database</span>
          <span className="count">{counts}</span>
          <button
            className="db-close"
            onClick={() => setOpen(false)}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="tables">
          {Object.entries(tables).map(([name, rows]) => (
            <RowTable key={name} name={name} rows={rows} />
          ))}
        </div>
        <p className="hint">
          Live SELECT from the PGlite database in this tab, persisted to
          IndexedDB. Save an edit, then reload the page: the rows survive.
        </p>
      </dialog>
    </>
  );
}
