# better-content/core

Framework-free. Safe to import anywhere.

## createCmsEngine

```ts
function createCmsEngine(options: CmsEngineOptions): CmsEngine;

interface CmsEngineOptions {
  transport: Transport;
  storage?: ClientStorageAdapter;   // required only if file uploads are queued
  notify?: Notifier;                // default: console logger
  initialItems?: ItemMap;           // default: {}
}
```

### CmsEngine

```ts
interface CmsEngine {
  // store contract
  getSnapshot(): CmsSnapshot;
  subscribe(listener: () => void): () => void;

  // reads
  getItem(collection: string, id: string): Item | undefined;

  // deferred field editing
  editField(collection: string, id: string, fieldKey: string, value: unknown): void;
  setPendingImage(image: PendingImage): void;
  saveItem(collection: string, id: string): Promise<void>;
  saveAll(): Promise<void>;

  // immediate item operations (optimistic, roll back on failure, rethrow)
  createItem(collection: string, data: Record<string, unknown>,
             opts?: { id?: string; atStart?: boolean }): Promise<string>; // returns id
  updateItem(collection: string, id: string, patch: Record<string, unknown>): Promise<void>;
  deleteItem(collection: string, id: string): Promise<void>;
  reorderItems(collection: string, orderedIds: string[]): Promise<void>;
}

interface CmsSnapshot {
  items: ItemMap;
  pendingImages: PendingImage[];
  saving: boolean;
  hasUnsavedChanges: boolean;
}
```

Behavior notes:

- `editField` creates the item in memory when the id does not exist.
  `fieldKey` supports dotted paths.
- `saveItem`/`saveAll` return without doing anything while a save is in
  flight, and never reject: failures notify and keep dirty state.
- The immediate operations notify on success and failure, and rethrow on
  failure after rolling back.

## Transports

```ts
interface Transport {
  save(collection: string, id: string, item: Item): Promise<void>;
  patch(collection: string, id: string, partial: Record<string, unknown>): Promise<void>;
  remove(collection: string, id: string): Promise<void>;
}

function restTransport(options?: { apiBasePath?: string }): Transport;  // default "/api/admin"
function adapterTransport(data: DataAdapter): Transport;
function inMemoryTransport(seed?: ItemMap): InMemoryTransport;

interface InMemoryTransport extends Transport {
  get(collection: string, id: string): Item | undefined;
  list(collection: string): Item[];
}
```

## Content types

```ts
type Item = Record<string, unknown> & { id: string };
type ItemMap = Record<string, Item[]>;

interface EntityAddress { id: string; collection: string }
type Editable<T> = T & EntityAddress;

interface PendingImage {
  file: File | null;       // null when isExternal
  localUrl: string;
  collection: string;
  itemId: string;
  fieldKey: string;
  isExternal?: boolean;
}
```

## Query

```ts
type QueryFilterOp = "eq" | "ne" | "lt" | "lte" | "gt" | "gte" | "in" | "nin" | "contains";
type QueryFilter = { field: string; op: QueryFilterOp; value: unknown };
type QueryFilterGroup = { or: QueryFilter[] };
type QueryCondition = QueryFilter | QueryFilterGroup;

type Query = {
  filters?: QueryCondition[];    // AND at the top level
  orderBy?: { field: string; direction: "asc" | "desc" }[];
  limit?: number;
  offset?: number;
  populate?: string[];           // resolved by resolveRelations, never the adapter
};

function isFilterGroup(c: QueryCondition): c is QueryFilterGroup;
```

## Seam interfaces

```ts
interface DataAdapter {
  fetchCollection<T>(collection: string, q?: Query): Promise<(T & { id: string })[]>;
  fetchById<T>(collection: string, id: string): Promise<(T & { id: string }) | null>;
  create<T>(collection: string, data: T): Promise<T & { id: string }>;
  createWithId<T>(collection: string, id: string, data: T): Promise<T & { id: string }>;
  update<T>(collection: string, id: string, data: Partial<T>): Promise<void>;
  upsert<T>(collection: string, id: string, data: Partial<T>): Promise<void>;
  delete(collection: string, id: string): Promise<void>;
}

interface AuthAdapter {
  verifyRequest(req: Request): Promise<AuthIdentity | null>;
}
interface AuthIdentity {
  isAdmin: boolean;
  userId?: string;
  email?: string;
  [claim: string]: unknown;
}
type AuthorizeFn = (identity: AuthIdentity, req: Request) => boolean | Promise<boolean>;

interface ClientStorageAdapter { upload(file: File): Promise<{ url: string }> }
interface ServerStorageAdapter { sign(req: Request): Promise<unknown> }

interface Notifier {
  success: (message: string) => void;
  error: (message: string) => void;
}
const consoleNotifier: Notifier;

type Ref = { collection: string; id: string };
type RelationConfig = Record<string, { collection: string }>;

interface CmsAuthState {
  isAdmin: boolean;
  isEditing: boolean;
  toggleEdit: () => void;
}
```

## Helpers

```ts
function setPath(obj: Record<string, unknown>, fieldKey: string, value: unknown): Record<string, unknown>;
function getPath(obj: unknown, path: string): unknown;
function dirtyKey(collection: string, id: string): string;   // "collection:id"
```

`setPath` is the immutable dotted-path setter the engine uses; `getPath` is
its read-side counterpart.
