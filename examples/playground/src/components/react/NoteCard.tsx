import { ContentEditSpan, usePageContext } from "better-content/react";

export default function NoteCard() {
  const { hasUnsavedChanges } = usePageContext();

  return (
    <article className="island" data-framework="react">
      <header className="island__bar">
        <span className="island__dot"></span>
        <span className="island__name">React</span>
        <code className="island__hook">&lt;ContentEditSpan /&gt;</code>
        <span className="island__state" data-dirty={hasUnsavedChanges || undefined}>
          {hasUnsavedChanges ? "unsaved" : "synced"}
        </span>
      </header>
      <div className="island__body">
        <p className="island__path">page / shared.message</p>
        <ContentEditSpan
          as="p"
          className="island__text"
          collection="page"
          itemId="shared"
          fieldKey="message"
        />
      </div>
    </article>
  );
}
