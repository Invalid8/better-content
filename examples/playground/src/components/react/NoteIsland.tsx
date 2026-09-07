import { CmsAuthProvider, PageProvider } from "better-content/react";
import { editMode } from "../../lib/editMode";
import { useLiveEngine } from "./useLiveEngine";
import NoteCard from "./NoteCard";

export default function NoteIsland() {
  const { engine, isEditing } = useLiveEngine();

  if (!engine) return <p className="island-loading">starting React...</p>;

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
