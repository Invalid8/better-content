import { describe, expect, it, vi } from "vitest";
import { createCmsHandlers } from "../src/server/createCmsHandlers";
import type { AuthAdapter, DataAdapter } from "../src/core/types";

const adminAuth: AuthAdapter = {
  verifyRequest: async () => ({ isAdmin: true }),
};

const anonAuth: AuthAdapter = {
  verifyRequest: async () => null,
};

const fakeData = () =>
  ({
    fetchCollection: vi.fn(async () => []),
    fetchById: vi.fn(async () => null),
    create: vi.fn(async (_c: string, data: never) => ({
      ...(data as object),
      id: "new",
    })),
    createWithId: vi.fn(async (_c: string, id: string, data: never) => ({
      ...(data as object),
      id,
    })),
    update: vi.fn(async () => {}),
    upsert: vi.fn(async () => {}),
    delete: vi.fn(async () => {}),
  }) satisfies DataAdapter;

const ctx = (collection = "posts", id = "a1") => ({
  params: Promise.resolve({ collection, id }),
});

const jsonRequest = (method: string, body: unknown) =>
  new Request("http://test/api/admin/posts/a1", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

describe("createCmsHandlers", () => {
  it("GET returns the fetched document", async () => {
    const data = fakeData();
    data.fetchById.mockResolvedValueOnce({ id: "a1", title: "x" } as never);
    const { GET } = createCmsHandlers({ data, auth: adminAuth });
    const res = await GET(new Request("http://test"), ctx());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: "a1", title: "x" });
    expect(data.fetchById).toHaveBeenCalledWith("posts", "a1");
  });

  it("GET returns 404 when the document is missing", async () => {
    const { GET } = createCmsHandlers({ data: fakeData(), auth: adminAuth });
    const res = await GET(new Request("http://test"), ctx());
    expect(res.status).toBe(404);
  });

  it("PUT upserts the body", async () => {
    const data = fakeData();
    const { PUT } = createCmsHandlers({ data, auth: adminAuth });
    const res = await PUT(jsonRequest("PUT", { title: "x" }), ctx());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(data.upsert).toHaveBeenCalledWith("posts", "a1", { title: "x" });
  });

  it("PATCH updates the body", async () => {
    const data = fakeData();
    const { PATCH } = createCmsHandlers({ data, auth: adminAuth });
    await PATCH(jsonRequest("PATCH", { order: 2 }), ctx("sections", "hero"));
    expect(data.update).toHaveBeenCalledWith("sections", "hero", { order: 2 });
  });

  it("DELETE removes the document", async () => {
    const data = fakeData();
    const { DELETE } = createCmsHandlers({ data, auth: adminAuth });
    await DELETE(new Request("http://test", { method: "DELETE" }), ctx());
    expect(data.delete).toHaveBeenCalledWith("posts", "a1");
  });

  it("rejects invalid JSON bodies with 400", async () => {
    const { PUT } = createCmsHandlers({ data: fakeData(), auth: adminAuth });
    const res = await PUT(
      new Request("http://test", { method: "PUT", body: "not json" }),
      ctx(),
    );
    expect(res.status).toBe(400);
  });

  it("rejects non-object JSON bodies with 400", async () => {
    const { PUT } = createCmsHandlers({ data: fakeData(), auth: adminAuth });
    const res = await PUT(jsonRequest("PUT", [1, 2]), ctx());
    expect(res.status).toBe(400);
  });

  it("returns 401 with logout for unverified requests", async () => {
    const data = fakeData();
    const { PUT } = createCmsHandlers({ data, auth: anonAuth });
    const res = await PUT(jsonRequest("PUT", { title: "x" }), ctx());
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized", logout: true });
    expect(data.upsert).not.toHaveBeenCalled();
  });

  it("returns 403 for verified non-admins", async () => {
    const nonAdmin: AuthAdapter = {
      verifyRequest: async () => ({ isAdmin: false }),
    };
    const { DELETE } = createCmsHandlers({ data: fakeData(), auth: nonAdmin });
    const res = await DELETE(
      new Request("http://test", { method: "DELETE" }),
      ctx(),
    );
    expect(res.status).toBe(403);
  });

  it("returns 500 with the message when the adapter fails", async () => {
    const data = fakeData();
    data.upsert.mockRejectedValueOnce(new Error("db down"));
    const { PUT } = createCmsHandlers({ data, auth: adminAuth });
    const res = await PUT(jsonRequest("PUT", { title: "x" }), ctx());
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "db down" });
  });

  it("sign returns 404 without a storage adapter", async () => {
    const { sign } = createCmsHandlers({ data: fakeData(), auth: adminAuth });
    const res = await sign(new Request("http://test", { method: "POST" }));
    expect(res.status).toBe(404);
  });

  it("sign proxies to the storage adapter", async () => {
    const { sign } = createCmsHandlers({
      data: fakeData(),
      auth: adminAuth,
      storage: { sign: async () => ({ signature: "s1" }) },
    });
    const res = await sign(new Request("http://test", { method: "POST" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ signature: "s1" });
  });
});
