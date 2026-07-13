import type { Connect, Plugin } from "vite";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createCmsHandlers } from "better-content/server";
import { PostgresDataAdapter } from "better-content/adapters/postgres";

const sections = pgTable("sections", {
  id: text("id").primaryKey(),
  heading: text("heading"),
  tagline: text("tagline"),
  cover: text("cover"),
  order: integer("order"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
const schema = { sections };

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
`;

const auth = {
  verifyRequest: async (req: Request) => {
    const cookie = req.headers.get("cookie") ?? "";
    return /(^|;\s*)adminToken=demo-admin(;|$)/.test(cookie)
      ? { isAdmin: true }
      : null;
  },
};

const ready = (async () => {
  const client = new PGlite();
  await client.exec(DDL);
  const data = new PostgresDataAdapter({
    db: drizzle(client, { schema }) as never,
    schema,
  });
  return { data, handlers: createCmsHandlers({ data, auth }) };
})();

async function readBody(req: Connect.IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

export function cmsDevServer(): Plugin {
  return {
    name: "cms-dev-server",
    configureServer(server) {
      server.middlewares.use("/api/admin", (req, res) => {
        void (async () => {
          const { data, handlers } = await ready;
          const segments = (req.url ?? "")
            .split("?")[0]!
            .split("/")
            .filter(Boolean);
          const [collection, id] = segments;
          const method = (req.method ?? "GET").toUpperCase() as
            | "GET"
            | "PUT"
            | "PATCH"
            | "DELETE";
          const handler = handlers[method];
          if (!collection || !id || typeof handler !== "function") {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: "Not found" }));
            return;
          }

          res.setHeader("Content-Type", "application/json");

          if (method === "GET") {
            const doc = await data.fetchById(collection, id);
            res.statusCode = doc ? 200 : 404;
            res.end(JSON.stringify(doc ?? { error: "Document not found" }));
            return;
          }

          const body = method === "DELETE" ? undefined : await readBody(req);
          const request = new Request(
            `http://localhost/api/admin/${collection}/${id}`,
            {
              method,
              headers: {
                "Content-Type": "application/json",
                cookie: req.headers.cookie ?? "",
              },
              body,
            },
          );
          const response = await handler(request, {
            params: Promise.resolve({ collection, id }),
          });
          res.statusCode = response.status;
          response.headers.forEach((value, key) => res.setHeader(key, value));
          res.end(await response.text());
        })();
      });
    },
  };
}
