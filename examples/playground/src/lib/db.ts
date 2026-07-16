import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { PostgresDataAdapter } from "better-content/adapters/postgres";
import { CONTENT_CACHE_KEY } from "./demoContent";

const sections = pgTable("sections", {
  id: text("id").primaryKey(),
  heading: text("heading"),
  tagline: text("tagline"),
  cover: text("cover"),
  order: integer("order"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

const cards = pgTable("cards", {
  id: text("id").primaryKey(),
  title: text("title"),
  body: text("body"),
  order: integer("order"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

const schema = { sections, cards };

const DDL = `
  CREATE TABLE IF NOT EXISTS sections (
    id         text PRIMARY KEY,
    heading    text,
    tagline    text,
    cover      text,
    "order"    integer,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS cards (
    id         text PRIMARY KEY,
    title      text,
    body       text,
    "order"    integer,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
  );
`;

const SEED = `
  INSERT INTO sections (id, heading, tagline, cover, "order") VALUES
    ('hero',
     'Edit this page. It''s a database.',
     'Turn on Edit and click any text you see. Save, reload, it''s still here. Every field on this page is a row in a real Postgres, compiled to WebAssembly, persisted in your browser.',
     '',
     0);
  INSERT INTO cards (id, title, body, "order") VALUES
    ('own-your-data',
     'Own your data',
     'Content lives in your database, queried through a 7-method adapter. Here that database is PGlite in your tab; in production it''s your Postgres or Firestore.',
     0),
    ('framework-neutral',
     'One engine, any framework',
     'The engine is a plain external store: getSnapshot and subscribe. React binds to it in ~40 lines; Vue and Svelte can too. Nothing in core imports a framework.',
     1),
    ('named-seams',
     'Every seam has a name',
     'Transport, DataAdapter, StorageAdapter, AuthAdapter. This demo skips HTTP entirely: the engine talks straight to the database through adapterTransport.',
     2);
`;

const client = new PGlite("idb://better-content-demo");

export const adapter = new PostgresDataAdapter({
  db: drizzle(client, { schema }) as never,
  schema: schema as never,
});

export async function initDb(): Promise<void> {
  await client.exec(DDL);
  const seeded = await client.query<{ n: number }>(
    "SELECT count(*)::int AS n FROM sections",
  );
  if ((seeded.rows[0]?.n ?? 0) === 0) {
    await client.exec(SEED);
  }
}

export async function resetDemo(): Promise<void> {
  await client.exec("DELETE FROM sections; DELETE FROM cards;");
  await client.exec(SEED);
  localStorage.removeItem(CONTENT_CACHE_KEY);
  location.reload();
}
