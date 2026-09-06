# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.9.0] - 2026-09-06

### Changed

- **Both adapters now read back the same shape.** The seam exists so behaviour
  does not change when the backend does, and on reads it was not holding. Two
  divergences, in opposite directions:

  - The **Postgres adapter added a `collection` field** to every record it
    read. Firestore never did, `Item` does not declare it, and `toRow` already
    stripped it on the way in, so it was synthesized on read rather than
    stored. It is no longer added.
  - The **Postgres adapter stripped `createdAt` and `updatedAt`**, which
    Firestore returned. They are real stored columns written by the adapter
    itself, so they are no longer hidden.

  The rule both follow: a read returns the record's stored fields plus `id`,
  and an adapter neither invents fields nor hides them.

  **This is a behavior change.** Postgres consumers reading `item.collection`
  will find it gone, and will now see `createdAt`/`updatedAt` they did not see
  before.

- **Postgres timestamps read back as ISO strings**, matching Firestore, rather
  than as `Date` objects. Matching field names is not parity if one backend
  yields a `Date` and the other a string, and these records are JSON-serialized
  across `createContentHandler` and server-rendered payloads, where a `Date`
  becomes a string in transit regardless.

  Writes accept either form, so an adapter still takes back the record it just
  returned. Without that, reading from one environment and seeding another
  would fail on a Postgres target.

- **`seedItemMap` now also strips `createdAt` and `updatedAt`** alongside `id`
  and `collection`. All four address the record or belong to the adapter
  rather than being content, and a snapshot read from a backend carries all
  four. Passing the timestamps through would also have broken this function's
  documented promise that `createdAt` is reset: Firestore's `createWithId`
  overrides whatever it is handed, while Postgres would have inserted it
  verbatim — divergence again, one layer up.

### Added

- A cross-adapter parity suite (`test/adapter-parity.test.ts`) running the real
  Postgres adapter against PGlite and the Firestore adapter against a stub,
  pinning that the two agree on field names, on how a timestamp is
  represented, and that each accepts back what it returned. Write contracts
  were already pinned per adapter; read shapes were not, which is how both
  divergences survived.

## [0.8.1] - 2026-09-06

### Fixed

- **`ContentEditSpan` left the raw draft on screen next to the rendered value
  after an edit.** With a `renderValue` that turns the stored string into
  markup, blurring the field showed the source text and the rendered output
  one after the other, and every further edit round-tripped through the
  doubled text.

  While the field is focused its text is written imperatively, so React holds
  no record of those nodes. On blur it rendered the value and **appended**
  alongside them. The element is now cleared before React renders into it.

  Only reachable with a `renderValue`; the default identity renderer showed
  the same duplication but of identical text, so it read as a stutter rather
  than as markup. Reproduced and fixed under a real browser, not only jsdom.

## [0.8.0] - 2026-09-06

### Added

- **`seedItemMap(data, collections, options?)` in `better-content/server`.**
  The mirror of `loadItemMap`: it writes an `ItemMap` into a backend through
  the `DataAdapter` seam, borrowing that function's vocabulary rather than
  inventing new words.

  ```ts
  await seedItemMap(data, {
    portfolio: sections,                          // byId, the default
    projects: { items: projects, mode: "replace" },
  });
  ```

  - **`"byId"`** replaces the named records and leaves everything else in the
    collection alone.
  - **`"replace"`** makes the seeded array the collection: records present in
    the backend but absent from the seed are deleted.

  The mode is per collection because a real seed needs both in one run —
  singletons written by id, lists replaced wholesale. A bare `Item[]` is
  accepted, so an `ItemMap` is already a valid argument and
  `seedItemMap(target, await loadItemMap(source, …))` copies an environment.

  Each record is written as **`delete` then `createWithId`**. Neither verb
  expresses a portable replace on its own: `createWithId` rejects an existing
  id, and `upsert` merges rather than replaces and does not stamp `createdAt`,
  which on Firestore leaves the record invisible to a default read that orders
  by that field. Routing every write through `createWithId` is what avoids it,
  and that is the knowledge this helper exists to hold rather than have every
  consumer re-derive.

  Stated rather than left to be discovered: two round trips per record;
  `createdAt` is reset for a record that already existed; and the write is not
  atomic, because the seam has no batch or transaction. Writes run
  sequentially in a deterministic order and the first failure throws, naming
  the collection, the id and how many writes had landed — and saying so
  explicitly when the record was deleted before the write failed, since it is
  then gone rather than merely unwritten.

  There is deliberately **no `"merge"` mode**, and ordering is untouched with
  no `order` field invented. Both are argued in the docs.

### Fixed

- `seedItemMap` treats `id` **and `collection`** as a record's address rather
  than its fields, so neither is written into the document. This matters
  across backends: the Postgres adapter adds a `collection` field to every row
  it reads and the Firestore adapter does not, so copying a Postgres-sourced
  `ItemMap` into Firestore would otherwise have stored `collection` as a real
  field in every document.

  The underlying divergence between the two adapters' read shapes is **not**
  changed here.

## [0.7.0] - 2026-09-06

### Added

- **`Item` takes an optional type argument: `Item<T> = T & { id: string }`.**
  `Item` on its own is unchanged, so nothing breaks. Supply `T` to read your
  content at its real types instead of `unknown`:

  ```ts
  const banner = engine.getItem<Banner>("portfolio", "banner");
  banner?.skills;   // Skill[] | undefined, previously unknown
  ```

  This is not a new concept so much as a name for one: `DataAdapter` has
  returned `T & { id: string }` from `fetchCollection`, `fetchById`, `create`
  and `createWithId` since v1. Those four are now stated as `Item<T>`, which
  is the same type spelled once instead of twice.

  The parameter is on the **addressed read** in every binding: `getItem<T>` in
  core, `useCmsItem<T>` in React and Vue, `itemStore<T>` in Svelte.

- **`createItem<T>` and `updateItem<T>` type the write path.**

  ```ts
  await engine.createItem<Project>("projects", { title: "Portfolio", order: 0 });
  await engine.updateItem<Project>("projects", id, { order: 3 });
  ```

  Read and write are not the same promise, and the docs say so. On a read `T`
  is an **assertion**: nothing verifies the stored record matches, exactly as
  `fetchCollection<T>` has never verified it. On a write `T` is **checked**,
  because you hand over the object and TypeScript compares it to the shape.

  The constraint is `T extends object`, deliberately not
  `T extends Record<string, unknown>`: an `interface` has no implicit index
  signature and would have been rejected. This also **fixes an existing
  papercut** — `createItem`'s old `Record<string, unknown>` parameter rejected
  interface-typed objects outright, so passing your own `interface Project`
  required a cast or a type-alias workaround. It no longer does.

  `editField` stays `unknown`. A single field value cannot be typed without a
  collection-keyed content schema, which is deliberately not shipped.

### Notes

`ItemMap` is deliberately **not** generic. Measured against the real consumer
that motivated this release: deleting its entire compatibility shim left six
type errors, and every one was a `getItem` read. None came from reading
`items`, because list reads there narrow with a runtime type guard, which
checks for real. A collection-keyed schema would have returned a union for a
collection of mixed singletons, so it would not have fixed the case that
prompted this, while encouraging consumers to drop the guard that was
protecting them.

## [0.6.0] - 2026-09-05

### Added

- **Markdown editing for Vue and Svelte.** `useMarkdownEditor` had shipped
  only from `better-content/react`, so the three bindings were at parity on
  inline text and images but not on markdown. They are now.

  - `better-content/vue` gains `useMarkdownEditor({ initialValue, onSave })`,
    returning `value` and `charCount` as readonly refs, a `textareaRef` to
    bind to the element, and `setValue` / `insert` / `reset` / `save`.
  - `better-content/svelte` gains `markdownEdit({ initialValue, onSave })`,
    a readable store of `{ value, charCount }` carrying the same methods plus
    a `textarea` action to attach the element with.

  Both are the same headless primitive React ships: no toolbar, no preview,
  no parser, and no `CmsEngine` argument. The draft stays local until `save`
  hands it to your callback, so committing it through `editField` is your
  line of code.

  The behavior now lives in one framework-free place rather than being
  reimplemented per binding, so `insert` wraps the selection, inserts the
  placeholder into an empty one, and leaves the caret inside the wrap
  identically on all three. The React hook was rebuilt on it with **no change
  to its public API**; its existing tests pass unmodified.

### Changed

- **`useMarkdownEditor`'s `reset()` now returns to the value the editor was
  created with**, rather than following a later change to the `initialValue`
  prop. The two disagreed before: `value` was seeded once and never reseeded,
  while `reset` tracked the prop, so a changed prop made `reset()` jump to a
  value the editor had never displayed. No test covered it. `reset(explicit)`
  is unaffected, and the meaning is now the same on all three bindings.
- `MarkdownEditorApi`'s `setValue`, `insert`, `reset` and `save` now keep a
  stable identity across renders instead of being rebuilt when `value`
  changes. Their published type is unchanged; code using them in dependency
  arrays simply re-runs less. `setValue` remains typed `(next: string) => void`
  and, as before, is not a React state setter, so the updater-function form is
  not part of the contract.

## [0.5.0] - 2026-09-05

### Changed

- **`DataAdapter.createWithId` now rejects an id that already exists, on every
  adapter.** It previously meant two different things: the Firestore adapter
  overwrote the existing document, while the Postgres adapter threw a unique
  violation. The same call, against the same seam, did opposite things
  depending on the backend, which is exactly what the adapter seam exists to
  prevent. Neither behavior was pinned by a test.

  Firestore now issues `create` instead of `set`, so the rejection is enforced
  by Firestore itself with no read-then-write race. Postgres is unchanged.

  **This is a behavior change.** Code that relied on Firestore's
  `createWithId` silently overwriting will now see it reject. Use `upsert` to
  write regardless of what is there, or `delete` then `createWithId` to
  replace a document wholesale.

  The write contract is now stated on the `DataAdapter` type, in the adapter
  guide, and pinned by tests on both shipped adapters:

  | Method | On an id that already exists |
  |---|---|
  | `createWithId` | rejects; never overwrites |
  | `upsert` | writes, merging; omitted fields are kept |
  | `update` | patches the given fields |
  | `delete` | succeeds even when the id does not exist |

### Docs

- The adapter guide previously told adapter authors to "treat `upsert` as
  create-or-replace". Both shipped adapters merge rather than replace, so the
  guidance contradicted the implementations it was describing. Corrected, and
  the write contract added alongside it.
- Documented a Firestore-specific trap: reads order by `createdAt` by default
  and Firestore omits documents that lack the ordering field, so records
  written only through `upsert`, which does not stamp `createdAt`, can be
  missing from an unfiltered read.

## [0.4.0] - 2026-08-02

### Added

- `createContentHandler({ data, collections })` in `better-content/server`:
  the public read half of the CMS. It returns the same `ItemMap` a
  server-rendered page would build with `loadItemMap`, over HTTP. Public by
  default, with optional `auth`/`authorize` to gate it, `cacheControl`
  (default `no-store`), and the same `onError` handling as
  `createCmsHandlers`, so adapter messages never reach the client.
- `fetchItemMap(url, options?)` in `better-content/core`: the client-side
  counterpart. Reads a snapshot over HTTP for apps with no server of their
  own, and rejects a 200 that is not an object, which is what a misrouted
  URL returning `index.html` looks like.

  Together these close a real gap. `Transport` only writes, and reading went
  through `loadItemMap`, which needs a `DataAdapter` and so cannot run in a
  browser. The `GET` on `createCmsHandlers` is admin-gated and fetches one
  document by id, so it could not answer "the content for this page" either.
  A client-only app could therefore save edits it was unable to display.

  ```ts
  // server
  export const { GET } = createContentHandler({
    data,
    collections: { sections: { defaults, merge: "byId" } },
  });

  // client
  const initialItems = await fetchItemMap("/api/content");
  ```

- **Google auth**, a second provider for the `AuthAdapter` seam.

  `better-content/auth/google` exports `googleAuth({ clientId, adminEmails })`
  and a standalone `verifyGoogleIdToken`. Sign in with Google with no Firebase
  project and no service account: the ID token is verified locally, RS256
  against Google's published JWKS plus `exp` / `iss` / `aud`, with the JWKS
  cached per Google's own `cache-control`. Admin requires the signature to
  verify **and** `email_verified` to be true **and** the email to be
  allowlisted. No runtime dependency; Node's crypto and `fetch`.

  `better-content/auth/google/client` exports `GoogleAuthProvider`,
  `GoogleSignInButton` and `useGoogleAuth`. Three ways to sign in, because an
  ID token can only come from Google's own button or One Tap:

  - `<GoogleSignInButton />` forwards **every** option Google exposes
    (`width`, `logo_alignment`, `type`, `containerProps`, and the rest), not a
    hand-picked few.
  - `oneTap` on the provider shows One Tap, so there is no button at all.
  - `useGoogleAuth().applyCredential(idToken)` takes a credential you obtained
    yourself, so you can render any UI and run your own flow.

  Peer: `@react-oauth/google` >= 0.12, optional, needed only for the client
  entry point.

- `better-content/react` re-exports the `Notifier` and `PendingImage` types.
  Both are React-facing in practice (`notify` is a `PageProvider` prop,
  `pendingImages` is on the context), so configuring one provider no longer
  means importing from two entry points.

### Docs

- The auth and storage pages now say plainly that Firebase and Cloudinary are
  the only providers shipping today, that more are coming gradually, and how
  to write an `AuthAdapter` or `ClientStorageAdapter` yourself in the
  meantime. Both seams are one method.

## [0.3.1] - 2026-07-27

### Fixed

- `createCmsHandlers` no longer returns the underlying error message on a
  500. Adapter and driver failures routinely include query text and
  parameter values, so a failed write could hand the client the SQL
  statement and the data it carried. Those responses are now a generic
  `{ error: "Request failed" }`, and the error is passed to the new optional
  `onError` dependency (default `console.error`) instead. Gate and
  bad-request responses are unchanged, since those messages are the
  library's own.

## [0.3.0] - 2026-07-17

### Added

- `PageProvider` accepts an optional `engine` prop to bind an
  externally created engine, enabling one engine shared across multiple
  React roots or across frameworks (e.g. Astro islands).
- `better-content/vue`: a Vue 3 binding. `useCmsSnapshot(engine)` and
  `useCmsItem(engine, collection, id)` composables (shallow refs, scope-aware
  cleanup, identity-based granularity) and the `vContentEdit` directive for
  inline text editing with the shared draft, multi-line, and `data-cms-*`
  behavior. Vue is an optional peer.
- `better-content/svelte`: a Svelte binding with zero dependency on the
  svelte package. `engineStore(engine)` and `itemStore(engine, collection,
  id)` implement the readable-store contract (`itemStore` emits only when
  its item changes); the `contentEdit` element action provides inline text
  editing with the same draft, multi-line, and `data-cms-*` behavior as the
  React primitive. Works with Svelte 4 and 5.
- Image editing in the Vue and Svelte bindings, matching the React
  `EditableImage` semantics: picking a file previews it via an object URL
  and queues a pending upload that flushes on save; external URLs are
  validated (http/https) and queued without a file. Vue gets the
  `useEditableImage(engine, { collection, itemId, fieldKey })` composable
  (reactive `src`/`saving`/`hasError` plus `openFilePicker`, `selectFile`,
  `setExternalUrl`, `handleError`); Svelte gets `imageEdit(engine, options)`,
  a readable store with the same methods.

### Changed

- The `better-content/devtools` inspector dialog gained a "Full page"
  toggle that expands it to the viewport and locks page scroll while
  expanded.

## [0.2.0] - 2026-07-15

### Added

- Selector subscriptions in `better-content/react`: `useCmsItem(collection,
  id)` re-renders a component only when that item changes, and
  `useCmsEngine()` exposes the stable engine. `ContentEditSpan` now uses them
  internally, so each editor re-renders for its own item instead of every
  change. The coarse `usePageContext` behavior is unchanged.
- `better-content/devtools`: `registerDataInspector()` defines
  `<better-content-inspector>`, a framework-free custom element (shadow DOM,
  zero runtime dependencies) that shows live rows from a `DataAdapter` in a
  floating button + dialog. Give it your `engine` and it refreshes after every
  save. Works in React, Vue, Svelte, or plain HTML; mount it in development
  only. React users get a typed wrapper instead:
  `import { DataInspector } from "better-content/devtools/react"` (no JSX
  augmentation or manual registration needed, works on React 18 and 19).

### Fixed

- `ContentEditSpan` no longer collapses multi-line input: line breaks the
  browser represents as element markup are read back via `innerText`, and the
  rendered element uses `white-space: pre-wrap` so stored newlines stay
  visible in and out of edit mode.

## [0.1.1] - 2026-07-14

### Added

- `adapterTransport(dataAdapter)` in `better-content/core` — drive the engine
  straight through a `DataAdapter` with no HTTP hop (same-process backends,
  tests, in-browser databases).

### Fixed

- `PostgresDataAdapter` no longer imports `node:crypto`, making it usable in
  browser builds (e.g. against PGlite); `create()` falls back to a
  timestamp-based id where `crypto.randomUUID` is unavailable.
- `ContentEditSpan` keeps focused `contentEditable` drafts DOM-owned so typing
  preserves caret order and commits the edited text on blur.

## [0.1.0] - 2026-07-13

### Added

- `better-content/core` — framework-free CMS engine as an external store
  (`getSnapshot`/`subscribe`): deferred field edits with dirty tracking,
  save-all flush, pending-image upload queue, optimistic
  create/update/delete/reorder with rollback, `saving` reentrancy guard.
- `Transport` seam (`save`/`patch`/`remove`) with `restTransport` (default)
  and `inMemoryTransport` (tests/demos). Reorder persists as per-item patches.
- Neutral `Query` (filters incl. OR groups, orderBy, limit, offset, populate)
  and the 7-method `DataAdapter` contract.
- `better-content/react` — `PageProvider` (thin `useSyncExternalStore`
  binding), `usePageContext`, `ContentEditSpan`, `EditableImage`,
  `useMarkdownEditor`, `CmsAuthProvider`/`useCmsAuth`,
  `AnonymousEditProvider`.
- `better-content/server` — `createCmsHandlers` (Request/Response CRUD route
  factory + storage `sign` route), `createAdminGate`, `loadItemMap`,
  `resolveRelations`.
- `better-content/adapters/postgres` — Drizzle-backed, typed-only adapter
  (consumer owns schema/DDL; unsupported fields/collections throw).
- `better-content/adapters/firestore` — Firestore adapter; throws on
  `contains` and OR groups instead of silently degrading.
- `better-content/storage/cloudinary` (+ `/server`) — client/server split
  upload signing.
- `better-content/auth/firebase` (+ `/client`) — cookie-token verification
  with claim + allowlist gating; client provider with forced sign-out on
  401 `{ logout: true }`.

[0.9.0]: https://github.com/Invalid8/better-content/releases/tag/v0.9.0
[0.8.1]: https://github.com/Invalid8/better-content/releases/tag/v0.8.1
[0.8.0]: https://github.com/Invalid8/better-content/releases/tag/v0.8.0
[0.7.0]: https://github.com/Invalid8/better-content/releases/tag/v0.7.0
[0.6.0]: https://github.com/Invalid8/better-content/releases/tag/v0.6.0
[0.5.0]: https://github.com/Invalid8/better-content/releases/tag/v0.5.0
[0.4.0]: https://github.com/Invalid8/better-content/releases/tag/v0.4.0
[0.3.1]: https://github.com/Invalid8/better-content/releases/tag/v0.3.1
[0.3.0]: https://github.com/Invalid8/better-content/releases/tag/v0.3.0
[0.1.0]: https://github.com/Invalid8/better-content/releases/tag/v0.1.0
[0.2.0]: https://github.com/Invalid8/better-content/releases/tag/v0.2.0
[0.1.1]: https://github.com/Invalid8/better-content/releases/tag/v0.1.1
