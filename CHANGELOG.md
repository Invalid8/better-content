# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[0.3.1]: https://github.com/Invalid8/better-content/releases/tag/v0.3.1
[0.3.0]: https://github.com/Invalid8/better-content/releases/tag/v0.3.0
[0.1.0]: https://github.com/Invalid8/better-content/releases/tag/v0.1.0
[0.2.0]: https://github.com/Invalid8/better-content/releases/tag/v0.2.0
[0.1.1]: https://github.com/Invalid8/better-content/releases/tag/v0.1.1
