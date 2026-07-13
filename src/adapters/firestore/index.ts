import { cert, getApps, initializeApp } from "firebase-admin/app";
import {
  getFirestore,
  type Firestore,
  type Query as FirestoreQuery,
  type WhereFilterOp,
} from "firebase-admin/firestore";
import {
  isFilterGroup,
  type DataAdapter,
  type Query,
  type QueryFilterOp,
} from "better-content/core";

export interface FirestoreAdapterConfig {
  db?: Firestore;
  credentials?: {
    projectId?: string;
    clientEmail?: string;
    privateKey?: string;
    databaseURL?: string;
  };
  defaultOrderByField?: string;
}

const OP_MAP: Partial<Record<QueryFilterOp, WhereFilterOp>> = {
  eq: "==",
  ne: "!=",
  lt: "<",
  lte: "<=",
  gt: ">",
  gte: ">=",
  in: "in",
  nin: "not-in",
};

function serialize<T>(data: T): T {
  if (Array.isArray(data)) {
    return data.map(serialize) as unknown as T;
  }
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if ("_seconds" in obj && "_nanoseconds" in obj) {
      return new Date(
        (obj._seconds as number) * 1000 + (obj._nanoseconds as number) / 1e6,
      ).toISOString() as unknown as T;
    }
    if (typeof (obj as { toDate?: unknown }).toDate === "function") {
      return (obj as { toDate: () => Date })
        .toDate()
        .toISOString() as unknown as T;
    }
    const out: Record<string, unknown> = {};
    for (const key in obj) out[key] = serialize(obj[key]);
    return out as T;
  }
  return data;
}

export class FirestoreDataAdapter implements DataAdapter {
  private readonly db: Firestore;
  private readonly defaultOrderByField: string;

  constructor(config: FirestoreAdapterConfig = {}) {
    this.defaultOrderByField = config.defaultOrderByField ?? "createdAt";

    if (config.db) {
      this.db = config.db;
      return;
    }

    if (!getApps().length) {
      const c = config.credentials ?? {};
      initializeApp({
        credential: cert({
          ...(c.projectId !== undefined && { projectId: c.projectId }),
          ...(c.clientEmail !== undefined && { clientEmail: c.clientEmail }),
          ...(c.privateKey !== undefined && { privateKey: c.privateKey }),
        }),
        ...(c.databaseURL !== undefined && { databaseURL: c.databaseURL }),
      });
    }
    this.db = getFirestore();
  }

  private buildQuery(collection: string, q?: Query): FirestoreQuery {
    let ref: FirestoreQuery = this.db.collection(collection);

    if (!q) {
      return ref.orderBy(this.defaultOrderByField, "desc");
    }

    for (const c of q.filters ?? []) {
      if (isFilterGroup(c)) {
        throw new Error(
          "FirestoreDataAdapter does not support OR filter groups. Use a backend " +
            "with richer query support (e.g. Postgres) or split into separate reads.",
        );
      }
      const op = OP_MAP[c.op];
      if (!op) {
        throw new Error(
          `FirestoreDataAdapter does not support the '${c.op}' operator` +
            (c.op === "contains" ? " (no native substring search)." : "."),
        );
      }
      ref = ref.where(c.field, op, c.value);
    }
    for (const o of q.orderBy ?? []) {
      ref = ref.orderBy(o.field, o.direction);
    }
    if (q.offset != null) ref = ref.offset(q.offset);
    if (q.limit != null) ref = ref.limit(q.limit);
    return ref;
  }

  async fetchCollection<T = Record<string, unknown>>(
    collection: string,
    q?: Query,
  ): Promise<(T & { id: string })[]> {
    const snap = await this.buildQuery(collection, q).get();
    return snap.docs.map((doc) =>
      serialize({ id: doc.id, ...(doc.data() as T) }),
    );
  }

  async fetchById<T = Record<string, unknown>>(
    collection: string,
    id: string,
  ): Promise<(T & { id: string }) | null> {
    const doc = await this.db.collection(collection).doc(id).get();
    if (!doc.exists) return null;
    return serialize({ id: doc.id, ...(doc.data() as T) });
  }

  async create<T = Record<string, unknown>>(
    collection: string,
    data: T,
  ): Promise<T & { id: string }> {
    const ref = this.db.collection(collection).doc();
    await ref.set({ ...data, createdAt: new Date(), updatedAt: new Date() });
    return { id: ref.id, ...(data as T) };
  }

  async createWithId<T = Record<string, unknown>>(
    collection: string,
    id: string,
    data: T,
  ): Promise<T & { id: string }> {
    await this.db
      .collection(collection)
      .doc(id)
      .set({ ...data, createdAt: new Date(), updatedAt: new Date() });
    return { id, ...(data as T) };
  }

  async update<T = Record<string, unknown>>(
    collection: string,
    id: string,
    data: Partial<T>,
  ): Promise<void> {
    await this.db
      .collection(collection)
      .doc(id)
      .update({ ...data, updatedAt: new Date() });
  }

  async upsert<T = Record<string, unknown>>(
    collection: string,
    id: string,
    data: Partial<T>,
  ): Promise<void> {
    await this.db
      .collection(collection)
      .doc(id)
      .set({ ...data, updatedAt: new Date() }, { merge: true });
  }

  async delete(collection: string, id: string): Promise<void> {
    await this.db.collection(collection).doc(id).delete();
  }
}
