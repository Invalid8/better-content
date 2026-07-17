import { useEffect, useState } from "react";
import type { CmsEngine, Item } from "better-content/core";
import {
  CmsAuthProvider,
  ContentEditSpan,
  EditableImage,
  PageProvider,
  useCmsAuth,
  usePageContext,
} from "better-content/react";
import { ready } from "../../lib/engine";
import { editMode } from "../../lib/editMode";

function PreviewContent() {
  const { items, engine, getItem } = usePageContext();
  const { isEditing } = useCmsAuth();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const cover = (getItem("page", "hero")?.cover as string) ?? "";

  const cards = [...(items.cards ?? [])].sort(
    (a, b) => ((a.order as number) ?? 0) - ((b.order as number) ?? 0),
  );

  const reorder = (sourceId: string, targetId: string) => {
    if (!sourceId || sourceId === targetId) return;
    const ids = cards.map((card: Item) => card.id);
    const from = ids.indexOf(sourceId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    ids.splice(from, 1);
    ids.splice(to, 0, sourceId);
    void engine.reorderItems("cards", ids);
  };

  const add = () =>
    void engine.createItem("cards", {
      title: "New row",
      body: "I was just INSERTed. Click me in edit mode, then check the inspector.",
      order: cards.length,
    });

  return (
    <div className="hero-live">
      <div className="hero-copy">
        <ContentEditSpan
          as="h1"
          className="hero-headline"
          collection="page"
          itemId="hero"
          fieldKey="headline"
        />
        <ContentEditSpan
          as="p"
          className="hero-intro"
          collection="page"
          itemId="hero"
          fieldKey="intro"
        />
      </div>
      <EditableImage collection="page" itemId="hero" fieldKey="cover" src={cover}>
        {({ src, isEditing, saving, openFilePicker, imgProps }) => (
          <figure
            className="hero-cover"
            data-editing={isEditing || undefined}
            onClick={isEditing && !saving ? openFilePicker : undefined}
          >
            {src ? (
              <img {...imgProps} alt="Editable content cover" />
            ) : (
              <div className="cover-empty">cover image</div>
            )}
            {isEditing && <figcaption>click to replace the image</figcaption>}
          </figure>
        )}
      </EditableImage>

      <div className="cards-board">
        <div className="cards-grid">
          {cards.map((card) => (
            <article
              className="board-card"
              key={card.id}
              data-dragging={draggingId === card.id || undefined}
              onDragOver={(event) => {
                if (!isEditing || !draggingId || draggingId === card.id) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
              }}
              onDrop={(event) => {
                if (!isEditing) return;
                event.preventDefault();
                reorder(
                  event.dataTransfer.getData("text/plain") || draggingId || "",
                  card.id,
                );
                setDraggingId(null);
              }}
            >
              <ContentEditSpan
                as="h3"
                collection="cards"
                itemId={card.id}
                fieldKey="title"
              />
              <ContentEditSpan
                as="p"
                collection="cards"
                itemId={card.id}
                fieldKey="body"
              />
              {isEditing && (
                <div className="card-ops">
                  <span
                    className="drag-handle"
                    draggable
                    aria-label="Drag to reorder"
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", card.id);
                      setDraggingId(card.id);
                    }}
                    onDragEnd={() => setDraggingId(null)}
                  >
                    drag
                  </span>
                  <button
                    className="remove"
                    onClick={() => void engine.deleteItem("cards", card.id)}
                    aria-label="Delete card"
                  >
                    x delete
                  </button>
                </div>
              )}
            </article>
          ))}
          {isEditing && (
            <button className="add-card" onClick={add}>
              + INSERT a card
            </button>
          )}
        </div>
        {!isEditing && (
          <p className="board-hint">
            Toggle Edit in the preview header to insert, drag, and delete rows.
          </p>
        )}
      </div>
    </div>
  );
}

export default function PreviewFrame() {
  const [engine, setEngine] = useState<CmsEngine | null>(null);
  const [isEditing, setIsEditing] = useState(editMode.get());

  useEffect(() => {
    void ready.then(setEngine);
    return editMode.subscribe(() => setIsEditing(editMode.get()));
  }, []);

  if (!engine) {
    return <p className="island-loading">starting React preview...</p>;
  }

  return (
    <CmsAuthProvider
      value={{ isAdmin: false, isEditing, toggleEdit: editMode.toggle }}
    >
      <PageProvider engine={engine}>
        <PreviewContent />
      </PageProvider>
    </CmsAuthProvider>
  );
}
