import type { CmsEngine } from "better-content/core";
import { useMarkdownEditor } from "better-content/react";
import { renderMarkdown } from "../../lib/markdown";

const ITEM_ID = "note-react";

export default function MarkdownCard({
  engine,
  editing,
}: {
  engine: CmsEngine;
  editing: boolean;
}) {
  const md = useMarkdownEditor({
    initialValue: engine.getItem<{ body?: string }>("page", ITEM_ID)?.body ?? "",
    onSave: async (content) => {
      engine.editField("page", ITEM_ID, "body", content);
      await engine.saveItem("page", ITEM_ID);
    },
  });

  return (
    <article className="island" data-framework="react">
      <header className="island__bar">
        <span className="island__dot"></span>
        <span className="island__name">React</span>
        <code className="island__hook">useMarkdownEditor()</code>
        <span className="island__state">{md.charCount} chars</span>
      </header>
      <div className="island__body">
        <p className="island__path">page / {ITEM_ID}.body</p>
        {editing ? (
          <>
            <div className="draft__tools">
              <button type="button" onClick={() => md.insert("**", "**", "bold")}>
                bold
              </button>
              <button
                type="button"
                onClick={() => md.insert("[", "](https://)", "link")}
              >
                link
              </button>
              <button type="button" onClick={() => md.insert("`", "`", "code")}>
                code
              </button>
            </div>
            <textarea
              ref={md.textareaRef}
              className="draft__area"
              rows={7}
              spellCheck={false}
              value={md.value}
              onChange={(event) => md.setValue(event.target.value)}
            />
            <div className="draft__actions">
              <button
                type="button"
                className="draft__button"
                onClick={() => md.reset()}
              >
                Reset
              </button>
              <button
                type="button"
                className="draft__button draft__button--mark"
                onClick={() => void md.save()}
              >
                Save draft
              </button>
            </div>
          </>
        ) : (
          <div
            className="draft__rendered"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(md.value) }}
          />
        )}
      </div>
    </article>
  );
}
