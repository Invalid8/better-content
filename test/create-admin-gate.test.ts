import { describe, expect, it } from "vitest";
import { createAdminGate, UnauthorizedError } from "../src/server/createAdminGate";
import type { AuthAdapter } from "../src/core/types";

const req = new Request("http://test/api/admin/posts/a1");

const authWith = (identity: Awaited<ReturnType<AuthAdapter["verifyRequest"]>>) =>
  ({ verifyRequest: async () => identity }) satisfies AuthAdapter;

describe("createAdminGate", () => {
  it("returns the identity for an admin", async () => {
    const gate = createAdminGate(authWith({ isAdmin: true, userId: "u1" }));
    await expect(gate(req)).resolves.toEqual({ isAdmin: true, userId: "u1" });
  });

  it("throws 401 when the request cannot be verified", async () => {
    const gate = createAdminGate(authWith(null));
    const error = await gate(req).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UnauthorizedError);
    expect((error as UnauthorizedError).status).toBe(401);
  });

  it("throws 403 for a verified non-admin", async () => {
    const gate = createAdminGate(authWith({ isAdmin: false }));
    const error = await gate(req).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UnauthorizedError);
    expect((error as UnauthorizedError).status).toBe(403);
  });

  it("supports a custom authorize predicate", async () => {
    const gate = createAdminGate(
      authWith({ isAdmin: false, role: "editor" }),
      (identity) => identity.role === "editor",
    );
    await expect(gate(req)).resolves.toMatchObject({ role: "editor" });
  });
});
