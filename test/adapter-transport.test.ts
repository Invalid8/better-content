import { beforeAll, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { integer, pgTable, text } from "drizzle-orm/pg-core";
import { adapterTransport } from "../src/core/transport";
import { createCmsEngine } from "../src/core/engine";
import { PostgresDataAdapter } from "../src/adapters/postgres";
import type { DataAdapter, Notifier } from "../src/core";

const silent: Notifier = { success: () => {}, error: () => {} };

describe("adapterTransport", () => {
  it("maps save/patch/remove onto upsert/update/delete", async () => {
    const data = {
      upsert: vi.fn(async () => {}),
      update: vi.fn(async () => {}),
      delete: vi.fn(async () => {}),
    } as unknown as DataAdapter;
    const t = adapterTransport(data);

    await t.save("posts", "a1", { id: "a1", title: "x" });
    await t.patch("posts", "a1", { title: "y" });
    await t.remove("posts", "a1");

    expect(data.upsert).toHaveBeenCalledWith("posts", "a1", {
      id: "a1",
      title: "x",
    });
    expect(data.update).toHaveBeenCalledWith("posts", "a1", { title: "y" });
    expect(data.delete).toHaveBeenCalledWith("posts", "a1");
  });
});

describe("engine → adapterTransport → PostgresDataAdapter → PGlite", () => {
  const cards = pgTable("cards", {
    id: text("id").primaryKey(),
    title: text("title"),
    order: integer("order"),
  });
  const schema = { cards };

  let adapter: PostgresDataAdapter;

  beforeAll(async () => {
    const client = new PGlite();
    await client.exec(
      `CREATE TABLE cards (id text PRIMARY KEY, title text, "order" integer);`,
    );
    adapter = new PostgresDataAdapter({
      db: drizzle(client, { schema }) as never,
      schema,
    });
  }, 60000);

  it("round-trips the full demo data path without HTTP", async () => {
    const engine = createCmsEngine({
      transport: adapterTransport(adapter),
      notify: silent,
    });

    engine.editField("cards", "c1", "title", "First card");
    await engine.saveAll();
    expect(await adapter.fetchById("cards", "c1")).toMatchObject({
      title: "First card",
    });

    const id = await engine.createItem("cards", { title: "Second card" });
    expect(await adapter.fetchById("cards", id)).toMatchObject({
      title: "Second card",
    });

    await engine.reorderItems("cards", [id, "c1"]);
    expect(await adapter.fetchById("cards", "c1")).toMatchObject({ order: 1 });
    expect(await adapter.fetchById("cards", id)).toMatchObject({ order: 0 });

    await engine.deleteItem("cards", id);
    expect(await adapter.fetchById("cards", id)).toBeNull();
  });
});
