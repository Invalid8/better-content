import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import {
  boolean,
  date,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { PostgresDataAdapter } from "../src/adapters/postgres";

const projects = pgTable("projects", {
  id: text("id").primaryKey(),
  title: text("title"),
  views: integer("views"),
  published: boolean("published"),
  date: date("date"),
  tags: text("tags").array(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
const schema = { projects };

const DDL = `
  CREATE TABLE projects (
    id          text PRIMARY KEY,
    title       text,
    views       integer,
    published   boolean,
    date        date,
    tags        text[],
    created_at  timestamptz DEFAULT now(),
    updated_at  timestamptz DEFAULT now()
  );
`;

let client: PGlite;
let adapter: PostgresDataAdapter;

beforeAll(async () => {
  client = new PGlite();
  await client.exec(DDL);
  adapter = new PostgresDataAdapter({
    db: drizzle(client, { schema }) as never,
    schema,
  });
}, 60000);

beforeEach(async () => {
  await client.exec("TRUNCATE projects;");
});

describe("PostgresDataAdapter — constructor", () => {
  it("throws without a schema", () => {
    // @ts-expect-error intentionally omitting required schema
    expect(() => new PostgresDataAdapter({})).toThrowError(/requires a `schema`/);
  });

  it("throws when no db/pool/connectionString is given", () => {
    expect(() => new PostgresDataAdapter({ schema })).toThrowError(
      /requires one of `db`, `pool`, or `connectionString`/,
    );
  });
});

describe("PostgresDataAdapter — typed round-trips", () => {
  it("creates and fetches by id, preserving typed values", async () => {
    await adapter.createWithId("projects", "p1", {
      title: "Hello",
      views: 7,
      published: true,
      date: "2024-01-15",
      tags: ["react", "sql"],
    });

    const row = await adapter.fetchById("projects", "p1");
    expect(row).toMatchObject({
      id: "p1",
      collection: "projects",
      title: "Hello",
      views: 7,
      published: true,
      date: "2024-01-15",
      tags: ["react", "sql"],
    });
  });

  it("returns null for a missing id", async () => {
    expect(await adapter.fetchById("projects", "nope")).toBeNull();
  });

  it("create() generates an id", async () => {
    const created = await adapter.create("projects", { title: "Auto" });
    expect(created.id).toBeTruthy();
    const fetched = await adapter.fetchById("projects", created.id);
    expect(fetched).toMatchObject({ title: "Auto" });
  });
});

describe("PostgresDataAdapter — queries", () => {
  beforeEach(async () => {
    await adapter.createWithId("projects", "a", { title: "Alpha", views: 10 });
    await adapter.createWithId("projects", "b", { title: "Beta", views: 5 });
    await adapter.createWithId("projects", "c", { title: "Gamma", views: 20 });
  });

  it("filters with a binary op (gte)", async () => {
    const rows = await adapter.fetchCollection("projects", {
      filters: [{ field: "views", op: "gte", value: 10 }],
    });
    expect(rows.map((r) => r.id).sort()).toEqual(["a", "c"]);
  });

  it("filters with contains (ILIKE, case-insensitive)", async () => {
    const rows = await adapter.fetchCollection("projects", {
      filters: [{ field: "title", op: "contains", value: "et" }],
    });
    expect(rows.map((r) => r.id)).toEqual(["b"]);
  });

  it("filters with in / nin", async () => {
    const inRows = await adapter.fetchCollection("projects", {
      filters: [{ field: "id", op: "in", value: ["a", "c"] }],
    });
    expect(inRows.map((r) => r.id).sort()).toEqual(["a", "c"]);

    const ninRows = await adapter.fetchCollection("projects", {
      filters: [{ field: "id", op: "nin", value: ["a", "c"] }],
    });
    expect(ninRows.map((r) => r.id)).toEqual(["b"]);
  });

  it("expands an OR group", async () => {
    const rows = await adapter.fetchCollection("projects", {
      filters: [
        {
          or: [
            { field: "title", op: "eq", value: "Alpha" },
            { field: "title", op: "eq", value: "Gamma" },
          ],
        },
      ],
    });
    expect(rows.map((r) => r.id).sort()).toEqual(["a", "c"]);
  });

  it("applies orderBy, limit and offset", async () => {
    const rows = await adapter.fetchCollection("projects", {
      orderBy: [{ field: "views", direction: "asc" }],
      limit: 2,
      offset: 1,
    });
    expect(rows.map((r) => r.views)).toEqual([10, 20]);
  });
});

describe("PostgresDataAdapter — writes", () => {
  beforeEach(async () => {
    await adapter.createWithId("projects", "p1", { title: "Old", views: 1 });
  });

  it("update patches only the given fields", async () => {
    await adapter.update("projects", "p1", { title: "New" });
    const row = await adapter.fetchById("projects", "p1");
    expect(row).toMatchObject({ title: "New", views: 1 });
  });

  it("upsert inserts when absent and updates when present", async () => {
    await adapter.upsert("projects", "p2", { title: "Inserted" });
    expect(await adapter.fetchById("projects", "p2")).toMatchObject({
      title: "Inserted",
    });

    await adapter.upsert("projects", "p2", { title: "Updated" });
    expect(await adapter.fetchById("projects", "p2")).toMatchObject({
      title: "Updated",
    });
  });

  it("delete removes the row", async () => {
    await adapter.delete("projects", "p1");
    expect(await adapter.fetchById("projects", "p1")).toBeNull();
  });
});

describe("PostgresDataAdapter — strictness (no schemaless, no extra)", () => {
  it("throws on an unregistered collection", async () => {
    await expect(adapter.fetchCollection("ghosts")).rejects.toThrow(
      /not registered/,
    );
  });

  it("throws when writing an undeclared field", async () => {
    await expect(
      adapter.createWithId("projects", "x", { title: "ok", secret: "drift" }),
    ).rejects.toThrow(/Unknown field "secret"/);
  });

  it("throws when filtering on an undeclared field", async () => {
    await expect(
      adapter.fetchCollection("projects", {
        filters: [{ field: "secret", op: "eq", value: "x" }],
      }),
    ).rejects.toThrow(/Unknown field "secret"/);
  });
});
