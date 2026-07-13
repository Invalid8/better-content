# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
