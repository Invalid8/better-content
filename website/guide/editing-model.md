# The editing model

better-content distinguishes two kinds of changes, and the distinction shapes
the whole UX.

## Deferred field edits

Inline text and image edits are **deferred**: they update the page instantly
but only exist in memory until a save.

```
type in a ContentEditSpan
  └─ blur → editField(collection, id, fieldKey, value)
       ├─ snapshot updated (page shows the new text)
       └─ item marked dirty

click "Save all"
  └─ saveAll()
       ├─ pending images upload → URLs written into items
       ├─ transport.save(...) per dirty item
       └─ dirty flags and image queue cleared
```

Why deferred? Inline editing means the visitor is editing the real page.
Persisting every keystroke would hammer the backend and make half-finished
sentences canonical. Buffering gives the natural document feel: edit
everything, then commit once.

The pieces involved:

- `editField(collection, id, fieldKey, value)` applies an immutable update.
  Dotted `fieldKey` paths (`"cta.label"`) update nested values. If the id
  does not exist in the collection yet, the item is created in memory, which
  is how default/unseeded singletons become editable before they are ever
  persisted.
- `hasUnsavedChanges` on the snapshot tells your toolbar whether to enable
  the save button.
- `saveItem(collection, id)` flushes one item; `saveAll()` flushes every
  dirty item sequentially.
- Saves use **upsert** semantics through `Transport.save`, so saving an item
  that only ever existed in memory creates the row.

A failed save keeps the dirty state, so nothing is lost and the user can
retry. Outcomes are reported through the `notify` seam:

```ts
createCmsEngine({
  transport,
  notify: { success: toast.success, error: toast.error },
});
```

## Immediate item operations

Structural changes persist **immediately and optimistically**:

| Operation | Persists via | On failure |
|---|---|---|
| `createItem(collection, data, opts?)` | `save` (upsert) | inserted item removed |
| `updateItem(collection, id, patch)` | `patch` | previous list restored |
| `deleteItem(collection, id)` | `remove` | previous list restored |
| `reorderItems(collection, orderedIds)` | one `patch` per item (`order` field) | previous order restored |

The snapshot updates before the network call, so lists feel instant. On
failure the engine rolls back to the exact previous state, notifies through
`notify.error`, and **rethrows**, so your UI can also react if it wants to.

`createItem` accepts `{ id, atStart }` options: pass an explicit id for
addressable items, and `atStart: true` to prepend instead of append. Without
an id, one is generated (`crypto.randomUUID` where available).

`reorderItems` takes the full ordered id list, rewrites each item's integer
`order` field, and drops ids it does not know about. Keep an `order` column
in collections you reorder, and query with
`orderBy: [{ field: "order", direction: "asc" }]`.

## Images follow the deferred lane

`EditableImage` never uploads on selection. Picking a file:

1. creates a local object URL for an instant preview,
2. writes that preview URL into the item via `editField`,
3. queues a `PendingImage` addressed by `(collection, itemId, fieldKey)`.

At save time the engine resolves each pending image: files go through your
`ClientStorageAdapter.upload` and the returned hosted URL replaces the
preview; external URLs (a visitor pasting `https://...`) are validated and
used as-is, no upload involved. Queuing twice for the same field replaces the
earlier entry, so only the final choice uploads.

If a file is queued but the engine has no `storage` adapter, the save fails
loudly rather than persisting a blob URL that dies with the tab.

## Multi-line text

`ContentEditSpan` reads committed text via `innerText`, so the line breaks a
browser represents as `<div>`/`<br>` markup survive as real newlines in your
data, and it renders with `white-space: pre-wrap`, so stored newlines stay
visible in and out of edit mode. Your data holds plain `\n` characters,
nothing HTML.

## The saving guard

While a save is in flight, `saving` is true and reentrant saves return
immediately. Disable your save button on `saving` for feedback, but the
engine protects itself regardless.
