# How the engine works

This page explains the internals: what the engine actually is, how state
flows through it, and why the architecture looks the way it does. Nothing
here is required reading to use the package, but it makes everything else
predictable.

## The engine is an external store

At the center of better-content there is exactly one object, created by
`createCmsEngine`:

```ts
import { createCmsEngine, inMemoryTransport } from "better-content/core";

const engine = createCmsEngine({
  transport: inMemoryTransport(),
  initialItems: { sections: [{ id: "hero", heading: "Hello" }] },
});
```

The engine is a plain JavaScript object. It holds state privately and exposes
two things:

```ts
interface Store {
  getSnapshot(): CmsSnapshot;          // current immutable state
  subscribe(fn: () => void): () => void; // change notification, returns unsubscribe
}
```

This is the same contract Zustand, Redux, and TanStack Store use, and it is
the entire reason the core is framework-agnostic. React binds to it with the
built-in `useSyncExternalStore`, Vue binds `subscribe` to a `shallowRef`,
and Svelte wraps it in the readable-store contract; all three ship as
bindings, and one engine can serve them all at once. The engine neither
knows nor cares.

The internal rule that keeps this honest: **if a line of code could not run
under Vue, it does not belong in `core`.** Nothing in
`better-content/core` imports React, and the build verifies the bundle stays
clean.

## What is in a snapshot

```ts
interface CmsSnapshot {
  items: ItemMap;                 // { [collection]: Item[] }
  pendingImages: PendingImage[];  // queued uploads, not yet persisted
  saving: boolean;                // a save is in flight
  hasUnsavedChanges: boolean;     // the dirty set is non-empty
}
```

`ItemMap` is the one mental model for all content: every collection is a list
of items, and an item is any record with a stable `id`. There is no separate
concept for singletons. A hero section is simply an item you address by a
known id, like `sections/hero`.

Snapshots are **immutable**. Every mutation builds a new snapshot object, and
critically, it preserves the object identity of everything that did not
change:

```
editField("posts", "a", "title", "New")

items ──▶ new object
  posts ──▶ new array
    item a ──▶ new object   (the edited one)
    item b ──▶ SAME object  (untouched, same reference)
  sections ──▶ SAME array
```

This identity preservation is what makes fine-grained subscriptions possible.
`useCmsItem("posts", "b")` selects item `b` out of the snapshot; since its
reference did not change, `Object.is` says "same value" and React skips the
re-render. One edited field re-renders one editor.

## The write path: two lanes

The engine deliberately has two kinds of writes, because inline editing and
item management have different needs.

### Lane 1: deferred field edits

`editField(collection, id, fieldKey, value)` is what the inline editors call.
It never touches the network:

1. The item is updated immutably in the snapshot (created on the fly if the
   id does not exist yet, which is how unsaved singletons work).
2. The item is marked dirty in an internal `Set` keyed by
   `collection:id`.
3. Subscribers are notified.

Nothing persists until `saveItem(collection, id)` or `saveAll()` runs. That
is the editing UX contract: type freely across the whole page, then commit
once. `fieldKey` supports dotted paths (`"cta.label"`), applied through an
immutable `setPath` helper, so nested objects work without any schema.

### Lane 2: immediate item operations

`createItem`, `updateItem`, `deleteItem`, and `reorderItems` persist
instantly and optimistically:

```
createItem("posts", { title: "New" })
  1. insert into the snapshot            (UI updates now)
  2. transport.save(...)                 (network)
  3a. success → notify "Item added"
  3b. failure → remove it from the snapshot again, notify error, rethrow
```

Every immediate op keeps the previous state around and rolls back to it on
failure. `reorderItems` rewrites each item's integer `order` field and
persists one patch per item in parallel.

## The save pipeline

`saveAll` walks the dirty set and flushes each entry:

```
flush(collection, id)
  1. collect pendingImages addressed to this item
  2. for each image: resolve a URL
       external URL  → use as-is
       File          → storage.upload(file) → hosted URL
     write the URL into the item at the image's fieldKey
  3. transport.save(collection, id, item)   ← the whole item, upsert semantics
  4. update the snapshot with the saved item
  5. clear the item's pending images and dirty flag
```

Two details matter here:

- **Images are deferred too.** `EditableImage` shows an instant local
  preview (an object URL) and queues a `PendingImage`. The actual upload
  happens inside the save, so canceling edits never leaves orphaned files in
  your storage.
- **Saves are guarded.** While `saving` is true, reentrant `saveItem` and
  `saveAll` calls return immediately. One save at a time, no interleaved
  flushes.

Failures notify through the `Notifier` seam (a console logger by default;
pass your toast library) and leave the dirty state intact, so the user can
retry.

## The seams

The engine talks to the outside world only through named interfaces. Each
one is small on purpose.

```
                 ┌───────────────────────────────┐
                 │            CmsEngine          │
                 │  state · dirty · flush · ops  │
                 └──┬──────────┬──────────┬──────┘
                    │          │          │
              Transport   ClientStorage  Notifier
                    │       Adapter
     ┌──────────────┼──────────────┐
     ▼              ▼              ▼
restTransport  adapterTransport  inMemoryTransport
 (HTTP verbs)  (DataAdapter,      (a Map, for
     │          no HTTP hop)      tests and demos)
     ▼              ▼
 your server    DataAdapter ──▶ Postgres / Firestore / yours
```

### Transport: how writes leave the engine

```ts
interface Transport {
  save(collection, id, item): Promise<void>;    // upsert
  patch(collection, id, partial): Promise<void>;
  remove(collection, id): Promise<void>;
}
```

Three methods, because the engine only ever does three things to persistence.
`restTransport` maps them to PUT, PATCH, and DELETE against
`{apiBasePath}/{collection}/{id}`. `adapterTransport` skips HTTP entirely
and calls a `DataAdapter` in the same process, which is how the live demo
runs Postgres inside a browser tab. Writing your own (tRPC, server actions,
a queue) is implementing three functions.

### DataAdapter: how the server reaches your database

```ts
interface DataAdapter {
  fetchCollection(collection, query?): Promise<Item[]>;
  fetchById(collection, id): Promise<Item | null>;
  create(collection, data): Promise<Item>;
  createWithId(collection, id, data): Promise<Item>;
  update(collection, id, partial): Promise<void>;
  upsert(collection, id, partial): Promise<void>;
  delete(collection, id): Promise<void>;
}
```

Queries use a neutral `Query` type (filters, OR groups, orderBy, limit,
offset) so no backend's native query language leaks through the seam. An
adapter that cannot honor an operator **throws** instead of silently
returning wrong results; Firestore's adapter rejects `contains` and OR
groups with an error that tells you why.

### AuthAdapter and StorageAdapter

Auth is a single question: `verifyRequest(req) → identity | null`. The
route factory wraps it in a gate that turns the answer into 401/403
semantics. Storage is split in two halves so server SDKs never reach client
bundles: the client half uploads (`upload(file) → { url }`), the server half
signs (`sign(req)`).

## The server side

`createCmsHandlers({ data, auth, storage?, authorize? })` returns plain
`(Request, ctx) → Response` handlers (GET, PUT, PATCH, DELETE, plus `sign`).
They run anywhere the web platform Request/Response types exist: Next.js
route handlers, Remix, Hono, Bun, a bare Node server. Each handler:

1. passes the request through the admin gate (throws 401 with
   `{ logout: true }` for unverified requests, 403 for verified non-admins),
2. validates the JSON body,
3. calls the matching `DataAdapter` method,
4. maps errors to proper status codes.

`loadItemMap` is the read-side loader: it fetches several collections
concurrently into the `ItemMap` shape the engine hydrates from, with
per-collection queries, default merging, and explicit fallbacks.
`resolveRelations` inline-resolves reference fields (self-describing
`{ collection, id }` refs or bare ids mapped through a config), deduplicated
so each unique reference is fetched once regardless of how many documents
share it.

## The single-engine guarantee

Internal packages import each other through the **public** package
specifier, never relative paths: the React binding imports
`better-content/core`, not `../core`. Combined with the build marking the
package's own specifier as external, this guarantees exactly one engine
module instance at runtime, even when a consumer mixes subpath entries. The
same trick keeps `CmsAuthContext` a single context instance across the main
binding and auth providers.

## Why coarse and fine-grained coexist

The React binding provides both:

- `usePageContext()` re-renders its consumer on any engine change. Simple,
  and fine for toolbars that show `hasUnsavedChanges` or `saving`.
- `useCmsItem(collection, id)` re-renders only when that item's reference
  changes, which the immutability rules above make cheap and exact.

`ContentEditSpan` uses the fine-grained hook internally, so a page with
fifty editable fields re-renders one of them per keystroke commit, not
fifty.
