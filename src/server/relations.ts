import type { DataAdapter, Ref, RelationConfig } from "better-content/core";

function isRef(v: unknown): v is Ref {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as Ref).collection === "string" &&
    typeof (v as Ref).id === "string"
  );
}

export interface ResolveRelationsOptions {
  populate?: string[];
  relations?: RelationConfig;
}

export async function resolveRelations<T extends Record<string, unknown>>(
  adapter: DataAdapter,
  docs: T,
  options?: ResolveRelationsOptions,
): Promise<T>;
export async function resolveRelations<T extends Record<string, unknown>>(
  adapter: DataAdapter,
  docs: T[],
  options?: ResolveRelationsOptions,
): Promise<T[]>;
export async function resolveRelations<T extends Record<string, unknown>>(
  adapter: DataAdapter,
  docs: T | T[],
  options: ResolveRelationsOptions = {},
): Promise<T | T[]> {
  const list = Array.isArray(docs) ? docs : [docs];
  const relations = options.relations ?? {};
  const fields = options.populate ?? Object.keys(relations);
  if (!fields.length || !list.length) return docs;

  const cache = new Map<string, Promise<unknown>>();
  const load = (collection: string, id: string): Promise<unknown> => {
    const key = `${collection} ${id}`;
    let pending = cache.get(key);
    if (!pending) {
      pending = adapter.fetchById(collection, id);
      cache.set(key, pending);
    }
    return pending;
  };

  const toRef = (field: string, value: unknown): Ref | null => {
    if (isRef(value)) return value;
    const relation = relations[field];
    if (typeof value === "string" && relation) {
      return { collection: relation.collection, id: value };
    }
    return null;
  };

  const resolveValue = async (
    field: string,
    value: unknown,
  ): Promise<unknown> => {
    const ref = toRef(field, value);
    if (!ref) return value;
    const resolved = await load(ref.collection, ref.id);
    return resolved ?? value;
  };

  await Promise.all(
    list.map(async (doc) => {
      for (const field of fields) {
        const value = doc[field];
        if (Array.isArray(value)) {
          (doc as Record<string, unknown>)[field] = await Promise.all(
            value.map((v) => resolveValue(field, v)),
          );
        } else {
          (doc as Record<string, unknown>)[field] = await resolveValue(
            field,
            value,
          );
        }
      }
    }),
  );

  return docs;
}
