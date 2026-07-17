# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[0.1.0]: https://github.com/Invalid8/better-content/releases/tag/v0.1.0
[0.2.0]: https://github.com/Invalid8/better-content/releases/tag/v0.2.0
[0.1.1]: https://github.com/Invalid8/better-content/releases/tag/v0.1.1
