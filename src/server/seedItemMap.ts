import type { DataAdapter, Item } from "better-content/core";

export type SeedMode = "byId" | "replace";

export interface ItemCollectionSeedConfig {
  items: Item[];
  /** Overrides the run-wide mode for this collection. */
  mode?: SeedMode;
}

export type ItemMapSeedConfig = Record<
  string,
  Item[] | ItemCollectionSeedConfig
>;

export interface SeedItemMapOptions {
  /** Applies to collections that do not set their own. Defaults to `"byId"`. */
  mode?: SeedMode;
}

function seedError(
  collection: string,
  id: string,
  op: "delete" | "create",
  written: number,
  cause: unknown,
): Error {
  const reason = cause instanceof Error ? cause.message : String(cause);
  // A failed `create` follows a `delete` that already succeeded, so the record
  // is gone rather than merely unwritten. Saying so is the difference between
  // a re-run fixing it and the caller not knowing anything was lost.
  const lost =
    op === "create"
      ? ` The existing record was deleted and not rewritten, so "${collection}/${id}" no longer exists.`
      : "";
  return new Error(
    `seedItemMap failed to ${op} "${collection}/${id}" after ${written} ` +
      `successful write${written === 1 ? "" : "s"}: ${reason}${lost}`,
    { cause },
  );
}

/**
 * Writes an `ItemMap` into a backend through the `DataAdapter` seam.
 *
 * The saving is not the loop, which is a dozen lines. It is that a hand-rolled
 * seed has to know that `createWithId` stamps `createdAt` and `upsert` does
 * not, that Firestore hides documents lacking the field its default read
 * orders by, and that replacing a record portably means `delete` then
 * `createWithId` rather than either verb alone.
 *
 * Two modes, mirroring `loadItemMap`'s vocabulary:
 *
 * - `"byId"` (default) replaces the named records and leaves every other
 *   record in the collection alone.
 * - `"replace"` makes the seeded array the collection: records present in the
 *   backend but absent from the seed are deleted.
 *
 * Both are per collection, because a real seed needs both in one run.
 *
 * Deliberately absent: a `"merge"` mode. Merging new fields into existing
 * content is a migration concern, and it is the one shape that carries the
 * Firestore `createdAt` trap above. Call `data.upsert` directly if you want it.
 *
 * Ordering is not touched and no `order` field is invented. Both adapters
 * stamp millisecond timestamps, so a fast loop ties and read order becomes
 * arbitrary; put an explicit `order` field in the items and sort on it.
 *
 * Costs worth knowing rather than discovering:
 *
 * - **Two round trips per record**, since a replace is delete-then-create.
 * - **`createdAt` is reset** for a record that already existed. Correct for a
 *   replace, and it means default read order reflects the seed run.
 * - **Not atomic.** The seam has no batch or transaction, so there is a window
 *   where a record is deleted and not yet rewritten. Writes run sequentially
 *   in a deterministic order and the first failure throws, naming the
 *   collection, the id, and how many writes had landed.
 */
export async function seedItemMap(
  data: DataAdapter,
  collections: ItemMapSeedConfig,
  options: SeedItemMapOptions = {},
): Promise<void> {
  const fallbackMode = options.mode ?? "byId";
  let written = 0;

  for (const [collection, config] of Object.entries(collections)) {
    const items = Array.isArray(config) ? config : config.items;
    const mode = Array.isArray(config)
      ? fallbackMode
      : (config.mode ?? fallbackMode);

    if (mode === "replace") {
      const seeded = new Set(items.map((item) => item.id));
      const existing = await data.fetchCollection(collection);
      for (const row of existing) {
        if (seeded.has(row.id)) continue;
        try {
          await data.delete(collection, row.id);
        } catch (error) {
          throw seedError(collection, row.id, "delete", written, error);
        }
        written += 1;
      }
    }

    for (const item of items) {
      // `id` and `collection` address the record, they are not fields of it.
      // The adapters disagree here: the Postgres adapter strips both on write
      // but adds `collection` back on read, while Firestore does neither. So
      // copying a Postgres-sourced ItemMap into Firestore would otherwise
      // store `collection` as a real field. Stripping makes the seed write the
      // same document whichever backend it was read from.
      const { id, collection: _address, ...fields } = item;
      void _address;

      try {
        await data.delete(collection, id);
      } catch (error) {
        throw seedError(collection, id, "delete", written, error);
      }

      try {
        await data.createWithId(collection, id, fields);
      } catch (error) {
        throw seedError(collection, id, "create", written, error);
      }
      written += 1;
    }
  }
}
