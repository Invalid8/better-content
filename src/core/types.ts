export interface EntityAddress {
  id: string;
  collection: string;
}

export type Editable<T = Record<string, unknown>> = T & EntityAddress;

/**
 * A content record: the caller's shape plus the `id` every record carries.
 *
 * `Item` on its own is `Record<string, unknown> & { id: string }`, unchanged.
 * Supply `T` to read fields at their real types: `Item<Project>`.
 */
export type Item<T = Record<string, unknown>> = T & { id: string };

export type ItemMap = Record<string, Item[]>;

export interface PendingImage {
  file: File | null;
  localUrl: string;
  collection: string;
  itemId: string;
  fieldKey: string;
  isExternal?: boolean;
}

export interface ClientStorageAdapter {
  upload(file: File): Promise<{ url: string }>;
}

export interface CmsAuthState {
  isAdmin: boolean;
  isEditing: boolean;
  toggleEdit: () => void;
}

export type QueryFilterOp =
  | "eq"
  | "ne"
  | "lt"
  | "lte"
  | "gt"
  | "gte"
  | "in"
  | "nin"
  | "contains";

export type QueryFilter = { field: string; op: QueryFilterOp; value: unknown };

export type QueryFilterGroup = { or: QueryFilter[] };

export type QueryCondition = QueryFilter | QueryFilterGroup;

export type Query = {
  filters?: QueryCondition[];
  orderBy?: { field: string; direction: "asc" | "desc" }[];
  limit?: number;
  offset?: number;
  populate?: string[];
};

export type Ref = { collection: string; id: string };

export type RelationConfig = Record<string, { collection: string }>;

export interface DataAdapter {
  fetchCollection<T = Record<string, unknown>>(
    collection: string,
    q?: Query,
  ): Promise<Item<T>[]>;
  fetchById<T = Record<string, unknown>>(
    collection: string,
    id: string,
  ): Promise<Item<T> | null>;
  /** Creates a record under a generated id. */
  create<T = Record<string, unknown>>(
    collection: string,
    data: T,
  ): Promise<Item<T>>;
  /**
   * Creates a record under the given id.
   *
   * **Rejects if `id` already exists.** This is the only write that refuses
   * to touch an existing record; use `upsert` to write regardless. An adapter
   * that overwrites here is not conforming, and callers that need a replace
   * must `delete` first.
   */
  createWithId<T = Record<string, unknown>>(
    collection: string,
    id: string,
    data: T,
  ): Promise<Item<T>>;
  /** Applies a partial change to an existing record. */
  update<T = Record<string, unknown>>(
    collection: string,
    id: string,
    data: Partial<T>,
  ): Promise<void>;
  /**
   * Writes whether or not the record exists, merging into it when it does.
   * Fields the caller omits are left as they are.
   */
  upsert<T = Record<string, unknown>>(
    collection: string,
    id: string,
    data: Partial<T>,
  ): Promise<void>;
  /** Removes a record. Succeeds when `id` does not exist. */
  delete(collection: string, id: string): Promise<void>;
}

export interface AuthIdentity {
  isAdmin: boolean;
  userId?: string;
  email?: string;
  [claim: string]: unknown;
}

export type AuthorizeFn = (
  identity: AuthIdentity,
  req: Request,
) => boolean | Promise<boolean>;

export interface AuthAdapter {
  verifyRequest(req: Request): Promise<AuthIdentity | null>;
}

export interface ServerStorageAdapter {
  sign(req: Request): Promise<unknown>;
}

export interface StorageAdapter extends ClientStorageAdapter {
  sign?(req: Request): Promise<unknown>;
}
