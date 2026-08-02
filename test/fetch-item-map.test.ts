import { describe, expect, it, vi } from "vitest";
import { fetchItemMap } from "../src/core/content";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("fetchItemMap", () => {
  it("returns the item map and asks for JSON", async () => {
    const items = { sections: [{ id: "hero", heading: "Hi" }] };
    const fetchImpl = vi.fn(async () => jsonResponse(items));

    await expect(
      fetchItemMap("/api/content", { fetch: fetchImpl as never }),
    ).resolves.toEqual(items);

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("/api/content");
    expect(new Headers(init.headers).get("Accept")).toBe("application/json");
  });

  it("throws with the status when the response is not ok", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ error: "nope" }, 503));

    await expect(
      fetchItemMap("/api/content", { fetch: fetchImpl as never }),
    ).rejects.toThrow(/\(503\)/);
  });

  // A misrouted URL usually still returns 200, with the SPA's index.html.
  it("rejects a 200 that is not an object", async () => {
    for (const body of ["<!doctype html>", [1, 2, 3], null]) {
      const fetchImpl = vi.fn(async () => jsonResponse(body));
      await expect(
        fetchItemMap("/api/content", { fetch: fetchImpl as never }),
      ).rejects.toThrow(/not an ItemMap/);
    }
  });

  it("passes the abort signal through", async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn(async () => jsonResponse({}));

    await fetchItemMap("/api/content", {
      fetch: fetchImpl as never,
      signal: controller.signal,
    });

    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.signal).toBe(controller.signal);
  });

  it("explains itself when the runtime has no fetch", async () => {
    vi.stubGlobal("fetch", undefined);
    try {
      await expect(fetchItemMap("/api/content")).rejects.toThrow(
        /no global fetch/,
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("uses the global fetch when none is passed", async () => {
    const items = { sections: [{ id: "hero" }] };
    const fetchImpl = vi.fn(async () => jsonResponse(items));
    vi.stubGlobal("fetch", fetchImpl);
    try {
      await expect(fetchItemMap("/api/content")).resolves.toEqual(items);
      expect(fetchImpl).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
