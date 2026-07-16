import { useEffect, useState } from "react";
import type { CmsEngine } from "better-content/core";
import { CmsAuthProvider, PageProvider } from "better-content/react";
import { ready } from "../../lib/engine";
import { editMode } from "../../lib/editMode";
import NoteCard from "./NoteCard";

export default function NoteIsland() {
  const [engine, setEngine] = useState<CmsEngine | null>(null);
  const [isEditing, setIsEditing] = useState(editMode.get());

  useEffect(() => {
    void ready.then(setEngine);
    return editMode.subscribe(() => setIsEditing(editMode.get()));
  }, []);

  if (!engine) {
    return <p className="island-loading">starting React island…</p>;
  }

  return (
    <CmsAuthProvider
      value={{ isAdmin: false, isEditing, toggleEdit: editMode.toggle }}
    >
      <PageProvider engine={engine}>
        <NoteCard />
      </PageProvider>
    </CmsAuthProvider>
  );
}
