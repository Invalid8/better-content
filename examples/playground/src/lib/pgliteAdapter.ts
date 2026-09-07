import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { PostgresDataAdapter } from "better-content/adapters/postgres";
import type { DataAdapter, Item } from "better-content/core";
import { seedItems } from "./seed";

// The playground schema: two tables, owned by the app, not by the library.
const page = pgTable("page", {
  id: text("id").primaryKey(),
  headline: text("headline"),
  tagline: text("tagline"),
  intro: text("intro"),
  message: text("message"),
  cover: text("cover"),
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

const schema = { page, cards };

const DDL = `
  CREATE TABLE IF NOT EXISTS page (
    id         text PRIMARY KEY,
    headline   text,
    tagline    text,
    intro      text,
    message    text,
    cover      text,
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
  ALTER TABLE page ADD COLUMN IF NOT EXISTS tagline text;
`;

const client = new PGlite("idb://better-content");

export const adapter: DataAdapter = new PostgresDataAdapter({
  db: drizzle(client, { schema }) as never,
  schema: schema as never,
});

async function seed(): Promise<void> {
  for (const [collection, rows] of Object.entries(seedItems)) {
    for (const { id, ...fields } of rows as Item[]) {
      await adapter.createWithId(collection, id, fields);
    }
  }
}

export async function init(): Promise<void> {
  await client.exec(DDL);
  const existing = await client.query<{ n: number }>(
    "SELECT count(*)::int AS n FROM page",
  );
  if ((existing.rows[0]?.n ?? 0) === 0) await seed();
}

export async function reset(): Promise<void> {
  await client.exec("DELETE FROM page; DELETE FROM cards;");
  await seed();
}
