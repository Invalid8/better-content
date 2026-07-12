import type { Connect, Plugin } from "vite";
import { createCmsHandlers } from "better-content/server";
import type { DataAdapter, Item } from "better-content/core";

const store = new Map<string, Map<string, Item>>();

const table = (collection: string) => {
  let t = store.get(collection);
  if (!t) {
    t = new Map();
    store.set(collection, t);
  }
  return t;
};

const data: DataAdapter = {
  async fetchCollection(collection) {
    return [...table(collection).values()] as never;
  },
  async fetchById(collection, id) {
    return (table(collection).get(id) ?? null) as never;
  },
  async create(collection, body) {
    const id = crypto.randomUUID();
    const item = { ...(body as object), id } as Item;
    table(collection).set(id, item);
    return item as never;
  },
  async createWithId(collection, id, body) {
    const item = { ...(body as object), id } as Item;
    table(collection).set(id, item);
    return item as never;
  },
  async update(collection, id, patch) {
    const existing = table(collection).get(id);
    if (!existing) throw new Error(`No item ${collection}/${id}`);
    table(collection).set(id, { ...existing, ...(patch as object), id });
  },
  async upsert(collection, id, body) {
    table(collection).set(id, { ...(body as object), id } as Item);
  },
  async delete(collection, id) {
    table(collection).delete(id);
  },
};

const handlers = createCmsHandlers({
  data,
  auth: { verifyRequest: async () => ({ isAdmin: true }) },
});

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
          const body =
            method === "GET" || method === "DELETE"
              ? undefined
              : await readBody(req);
          const request = new Request(
            `http://localhost/api/admin/${collection}/${id}`,
            { method, headers: { "Content-Type": "application/json" }, body },
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
