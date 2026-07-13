import { describe, expect, it, vi } from "vitest";
import { loadItemMap } from "../src/server/loadItemMap";
import type { DataAdapter } from "../src/core/types";

function adapterWith(
  fetchCollection: (collection: string, q?: unknown) => Promise<unknown>,
): DataAdapter {
  const unused = vi.fn(async () => undefined);
  return {
    fetchCollection: fetchCollection as DataAdapter["fetchCollection"],
    fetchById: vi.fn(async () => null),
    create: unused as unknown as DataAdapter["create"],
    createWithId: unused as unknown as DataAdapter["createWithId"],
    update: unused,
    upsert: unused,
    delete: unused,
  };
}

describe("loadItemMap", () => {
  it("loads configured collections and passes each query to the adapter", async () => {
    const fetchCollection = vi.fn(async (collection: string) => [
      { id: `${collection}-1` },
    ]);
    const data = adapterWith(fetchCollection);
    const projectsQuery = {
      orderBy: [{ field: "order", direction: "asc" as const }],
    };

    const result = await loadItemMap(data, {
      projects: { query: projectsQuery },
      tools: {},
    });

    expect(Object.keys(result)).toEqual(["projects", "tools"]);
    expect(result.projects).toEqual([{ id: "projects-1" }]);
    expect(fetchCollection).toHaveBeenCalledWith("projects", projectsQuery);
    expect(fetchCollection).toHaveBeenCalledWith("tools", undefined);
  });

  it("merges fetched fields over defaults by id and appends new rows", async () => {
    const data = adapterWith(
      vi.fn(async () => [
        { id: "hero", title: "Stored" },
        { id: "contact", title: "Contact" },
      ]),
    );

    const result = await loadItemMap(data, {
      pages: {
        defaults: [{ id: "hero", title: "Default", subtitle: "Kept" }],
        merge: "byId",
      },
    });

    expect(result.pages).toEqual([
      { id: "hero", title: "Stored", subtitle: "Kept" },
      { id: "contact", title: "Contact" },
    ]);
  });

  it("uses an explicit fallback only when fetching throws", async () => {
    const data = adapterWith(
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );
    const fallback = [{ id: "static", title: "Available" }];

    await expect(
      loadItemMap(data, { projects: { fallback } }),
    ).resolves.toEqual({ projects: fallback });

    await expect(loadItemMap(data, { projects: {} })).rejects.toThrow(
      "offline",
    );
  });

  it("does not replace a successful empty result with the fallback", async () => {
    const data = adapterWith(vi.fn(async () => []));
    const result = await loadItemMap(data, {
      projects: { fallback: [{ id: "static" }] },
    });
    expect(result.projects).toEqual([]);
  });
});
