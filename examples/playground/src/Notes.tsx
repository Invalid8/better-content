import { useState, type DragEvent } from "react";
import { ContentEditSpan, useCmsAuth, usePageContext } from "better-content/react";

type DropTarget = {
  id: string;
  placement: "before" | "after";
};

export function Notes() {
  const { isEditing } = useCmsAuth();
  const { items, createItem, deleteItem, reorderItems } = usePageContext();
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const cards = [...(items.cards ?? [])].sort(
    (a, b) => ((a.order as number) ?? 0) - ((b.order as number) ?? 0),
  );

  const move = (id: string, targetId: string, placement: DropTarget["placement"]) => {
    const ids = cards.map((c) => c.id);
    const from = ids.indexOf(id);
    const target = ids.indexOf(targetId);
    if (from < 0 || target < 0 || id === targetId) return;
    ids.splice(from, 1);
    const targetAfterRemoval = ids.indexOf(targetId);
    ids.splice(placement === "after" ? targetAfterRemoval + 1 : targetAfterRemoval, 0, id);
    void reorderItems("cards", ids);
  };

  const getDropTarget = (e: DragEvent<HTMLElement>, id: string): DropTarget => {
    const rect = e.currentTarget.getBoundingClientRect();
    const placement =
      e.clientY > rect.top + rect.height / 2 || e.clientX > rect.left + rect.width / 2
        ? "after"
        : "before";
    return { id, placement };
  };

  const startDrag = (e: DragEvent<HTMLButtonElement>, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  };

  const overCard = (e: DragEvent<HTMLElement>, id: string) => {
    if (!draggedId || draggedId === id) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropTarget(getDropTarget(e, id));
  };

  const dropOnCard = (e: DragEvent<HTMLElement>, id: string) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData("text/plain") || draggedId;
    const target = dropTarget?.id === id ? dropTarget : getDropTarget(e, id);
    if (sourceId) move(sourceId, target.id, target.placement);
    setDraggedId(null);
    setDropTarget(null);
  };

  const endDrag = () => {
    setDraggedId(null);
    setDropTarget(null);
  };

  const add = () =>
    void createItem("cards", {
      title: "New note",
      body: "Click me in edit mode. I am already a row in the cards table.",
      order: cards.length,
    });

  return (
    <section className="notes">
      <div className="notes-head">
        <h2>Field notes: each card is a row</h2>
        {isEditing && (
          <button className="btn" onClick={add}>
            + Add card
          </button>
        )}
      </div>
      <div className="card-grid">
        {cards.map((card) => (
          <article
            className={[
              "card",
              draggedId === card.id ? "dragging" : "",
              dropTarget?.id === card.id ? `drop-${dropTarget.placement}` : "",
            ]
              .filter(Boolean)
              .join(" ")}
            key={card.id}
            onDragOver={isEditing ? (e) => overCard(e, card.id) : undefined}
            onDragLeave={() => {
              if (dropTarget?.id === card.id) setDropTarget(null);
            }}
            onDrop={isEditing ? (e) => dropOnCard(e, card.id) : undefined}
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
                <button
                  className="drag-handle"
                  draggable
                  onDragStart={(e) => startDrag(e, card.id)}
                  onDragEnd={endDrag}
                  aria-label={`Drag ${String(card.title ?? "card")} to reorder`}
                  title="Drag to reorder"
                >
                  ⋮⋮
                </button>
                <button
                  className="remove"
                  onClick={() => void deleteItem("cards", card.id)}
                  aria-label="Delete card"
                >
                  ✕ delete
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
