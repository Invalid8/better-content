import { describe, expect, it, vi } from "vitest";
import { createContentHandler } from "../src/server/createContentHandler";
import type { AuthAdapter, DataAdapter } from "../src/core/types";

const adminAuth: AuthAdapter = {
  verifyRequest: async () => ({ isAdmin: true }),
};

const anonAuth: AuthAdapter = {
  verifyRequest: async () => null,
};

const dataWith = (
  fetchCollection: DataAdapter["fetchCollection"],
): DataAdapter => {
  const unused = vi.fn(async () => undefined);
  return {
    fetchCollection,
    fetchById: vi.fn(async () => null),
    create: unused as unknown as DataAdapter["create"],
    createWithId: unused as unknown as DataAdapter["createWithId"],
    update: unused,
    upsert: unused,
    delete: unused,
  };
};

const request = () => new Request("http://test/api/content");

describe("createContentHandler", () => {
  it("returns the loaded item map as JSON", async () => {
    const data = dataWith(
      vi.fn(async (collection: string) => [
        { id: "hero", heading: `${collection} heading` },
      ]) as unknown as DataAdapter["fetchCollection"],
    );
    const { GET } = createContentHandler({ data, collections: { sections: {} } });

    const res = await GET(request());

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/json");
    await expect(res.json()).resolves.toEqual({
      sections: [{ id: "hero", heading: "sections heading" }],
    });
  });

  it("applies loadItemMap defaults so a fresh database still renders", async () => {
    const data = dataWith(
      vi.fn(async () => []) as unknown as DataAdapter["fetchCollection"],
    );
    const { GET } = createContentHandler({
      data,
      collections: {
        sections: {
          defaults: [{ id: "hero", heading: "Edit this heading" }],
          merge: "byId",
        },
      },
    });

    await expect((await GET(request())).json()).resolves.toEqual({
      sections: [{ id: "hero", heading: "Edit this heading" }],
    });
  });

  it("is public by default", async () => {
    const data = dataWith(
      vi.fn(async () => [{ id: "hero" }]) as unknown as DataAdapter["fetchCollection"],
    );
    const { GET } = createContentHandler({ data, collections: { sections: {} } });

    expect((await GET(request())).status).toBe(200);
  });

  it("works without a Request when it is not gated", async () => {
    const data = dataWith(
      vi.fn(async () => [{ id: "hero" }]) as unknown as DataAdapter["fetchCollection"],
    );
    const { GET } = createContentHandler({ data, collections: { sections: {} } });

    expect((await GET()).status).toBe(200);
  });

  it("gates the read when auth is supplied", async () => {
    const data = dataWith(
      vi.fn(async () => [{ id: "hero" }]) as unknown as DataAdapter["fetchCollection"],
    );

    const open = createContentHandler({
      data,
      collections: { sections: {} },
      auth: adminAuth,
    });
    expect((await open.GET(request())).status).toBe(200);

    const shut = createContentHandler({
      data,
      collections: { sections: {} },
      auth: anonAuth,
    });
    expect((await shut.GET(request())).status).toBe(401);
  });

  it("does not leak adapter error messages to the client", async () => {
    const onError = vi.fn();
    const data = dataWith(
      vi.fn(async () => {
        throw new Error("select * from sections where secret = 'hunter2'");
      }) as unknown as DataAdapter["fetchCollection"],
    );
    const { GET } = createContentHandler({
      data,
      collections: { sections: {} },
      onError,
    });

    const res = await GET(request());

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "Request failed" });
    expect(onError).toHaveBeenCalledOnce();
  });

  it("defaults to no-store so an edit shows on the next load", async () => {
    const data = dataWith(
      vi.fn(async () => []) as unknown as DataAdapter["fetchCollection"],
    );

    const fresh = createContentHandler({ data, collections: { sections: {} } });
    expect((await fresh.GET()).headers.get("Cache-Control")).toBe("no-store");

    const cached = createContentHandler({
      data,
      collections: { sections: {} },
      cacheControl: "public, max-age=60",
    });
    expect((await cached.GET()).headers.get("Cache-Control")).toBe(
      "public, max-age=60",
    );
  });
});
