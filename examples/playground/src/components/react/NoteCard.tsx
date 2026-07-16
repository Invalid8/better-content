import { ContentEditSpan, usePageContext } from "better-content/react";

export default function NoteCard() {
  const { hasUnsavedChanges } = usePageContext();

  return (
    <article className="note-card" data-framework="react">
      <header>
        <h3>React</h3>
        <code>&lt;ContentEditSpan /&gt;</code>
      </header>
      <ContentEditSpan
        as="p"
        className="note-text"
        collection="page"
        itemId="shared"
        fieldKey="message"
      />
      <footer>
        unsaved changes: <strong>{hasUnsavedChanges ? "yes" : "no"}</strong>
      </footer>
    </article>
  );
}
