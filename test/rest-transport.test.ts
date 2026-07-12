import { afterEach, describe, expect, it, vi } from "vitest";
import { restTransport } from "../src/core/transport";

const okFetch = () =>
  vi.fn(async () => new Response("{}", { status: 200 })) as unknown as typeof fetch;

const failFetch = () =>
  vi.fn(async () => new Response("{}", { status: 500 })) as unknown as typeof fetch;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("restTransport", () => {
  it("saves via PUT to the collection/id url", async () => {
    const fetchMock = okFetch();
    vi.stubGlobal("fetch", fetchMock);
    await restTransport().save("posts", "a1", { id: "a1", title: "x" });
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/posts/a1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "a1", title: "x" }),
    });
  });

  it("patches via PATCH", async () => {
    const fetchMock = okFetch();
    vi.stubGlobal("fetch", fetchMock);
    await restTransport().patch("posts", "a1", { title: "y" });
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/posts/a1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "y" }),
    });
  });

  it("removes via DELETE", async () => {
    const fetchMock = okFetch();
    vi.stubGlobal("fetch", fetchMock);
    await restTransport().remove("posts", "a1");
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/posts/a1", {
      method: "DELETE",
    });
  });

  it("honours a custom apiBasePath and encodes segments", async () => {
    const fetchMock = okFetch();
    vi.stubGlobal("fetch", fetchMock);
    await restTransport({ apiBasePath: "/cms" }).remove("my sections", "a/1");
    expect(fetchMock).toHaveBeenCalledWith("/cms/my%20sections/a%2F1", {
      method: "DELETE",
    });
  });

  it("throws on non-ok responses", async () => {
    vi.stubGlobal("fetch", failFetch());
    const t = restTransport();
    await expect(t.save("posts", "a1", { id: "a1" })).rejects.toThrow(
      "Failed to save item",
    );
    await expect(t.patch("posts", "a1", {})).rejects.toThrow(
      "Failed to update item",
    );
    await expect(t.remove("posts", "a1")).rejects.toThrow(
      "Failed to delete item",
    );
  });
});
