import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { PostgresDataAdapter } from "better-content/adapters/postgres";

const page = pgTable("page", {
  id: text("id").primaryKey(),
  headline: text("headline"),
  intro: text("intro"),
  cover: text("cover"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

const cards = pgTable("cards", {
  id: text("id").primaryKey(),
  title: text("title"),
  body: text("body"),
  order: integer("order"),
});

const schema = { page, cards };
const client = new PGlite("idb://better-content-playground");

export const adapter = new PostgresDataAdapter({
  db: drizzle(client, { schema }) as never,
  schema: schema as never,
});
