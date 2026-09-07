import { useState } from "react";
import type { Item } from "better-content/core";
import {
  CmsAuthProvider,
  ContentEditSpan,
  EditableImage,
  PageProvider,
  useCmsAuth,
  usePageContext,
} from "better-content/react";
import { editMode } from "../../lib/editMode";
import { useLiveEngine } from "./useLiveEngine";

function RowsContent() {
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

  const add = () => {
    const used = new Set(cards.map((card: Item) => card.id));
    let n = cards.length + 1;
    while (used.has(`new-row-${n}`)) n += 1;
    void engine.createItem(
      "cards",
      {
        title: "New row",
        body: "I was just INSERTed. Edit me, then watch the call log below.",
        order: cards.length,
      },
      { id: `new-row-${n}` },
    );
  };

  return (
    <div className="rows-board">
      <div className="rows-grid">
        {cards.map((card) => (
          <article
            className="row-card"
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
            <p className="row-card__id">cards / {card.id}</p>
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
              <div className="row-card__ops">
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
                  className="row-card__remove"
                  onClick={() => void engine.deleteItem("cards", card.id)}
                  aria-label="Delete card"
                >
                  delete
                </button>
              </div>
            )}
          </article>
        ))}
        {isEditing && (
          <button className="row-card row-card--add" onClick={add}>
            <span>+ insert a row</span>
          </button>
        )}
      </div>

      <EditableImage collection="page" itemId="hero" fieldKey="cover" src={cover}>
        {({ src, isEditing: editingImage, saving, openFilePicker, imgProps }) => (
          <figure
            className="rows-cover"
            data-editing={editingImage || undefined}
            onClick={editingImage && !saving ? openFilePicker : undefined}
          >
            {src ? (
              <img {...imgProps} alt="Editable cover" />
            ) : (
              <div className="rows-cover__empty">page / hero.cover</div>
            )}
            <figcaption>
              {editingImage
                ? "click to replace, the file becomes a data URL through the storage adapter"
                : "page / hero.cover, written through the storage adapter"}
            </figcaption>
          </figure>
        )}
      </EditableImage>
    </div>
  );
}

export default function RowsIsland() {
  const { engine, isEditing } = useLiveEngine();

  if (!engine) return <p className="island-loading">starting the engine...</p>;

  return (
    <CmsAuthProvider
      value={{ isAdmin: false, isEditing, toggleEdit: editMode.toggle }}
    >
      <PageProvider engine={engine}>
        <RowsContent />
      </PageProvider>
    </CmsAuthProvider>
  );
}
