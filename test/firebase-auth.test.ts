import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyIdToken = vi.fn();

vi.mock("firebase-admin/app", () => ({
  getApps: () => [{}],
  initializeApp: vi.fn(),
  cert: vi.fn(),
}));

vi.mock("firebase-admin/auth", () => ({
  getAuth: () => ({ verifyIdToken }),
}));

import { firebaseAuth } from "../src/auth/firebase";

const request = (cookie?: string) =>
  new Request("http://test/api/admin/posts/a1", {
    headers: cookie ? { cookie } : {},
  });

beforeEach(() => {
  verifyIdToken.mockReset();
});

describe("firebaseAuth", () => {
  const adapter = firebaseAuth({ adminEmails: ["admin@site.test"] });

  it("returns null without a token cookie", async () => {
    expect(await adapter.verifyRequest(request())).toBeNull();
    expect(verifyIdToken).not.toHaveBeenCalled();
  });

  it("returns null when the token fails verification", async () => {
    verifyIdToken.mockRejectedValueOnce(new Error("expired"));
    expect(
      await adapter.verifyRequest(request("adminToken=bad")),
    ).toBeNull();
  });

  it("grants admin only with both the claim and an allowlisted email", async () => {
    verifyIdToken.mockResolvedValueOnce({
      uid: "u1",
      email: "admin@site.test",
      admin: true,
    });
    expect(
      await adapter.verifyRequest(request("adminToken=good")),
    ).toEqual({ userId: "u1", email: "admin@site.test", isAdmin: true });
  });

  it("denies admin when the email is not allowlisted", async () => {
    verifyIdToken.mockResolvedValueOnce({
      uid: "u2",
      email: "other@site.test",
      admin: true,
    });
    const identity = await adapter.verifyRequest(request("adminToken=good"));
    expect(identity?.isAdmin).toBe(false);
  });

  it("denies admin when the claim is missing", async () => {
    verifyIdToken.mockResolvedValueOnce({
      uid: "u3",
      email: "admin@site.test",
    });
    const identity = await adapter.verifyRequest(request("adminToken=good"));
    expect(identity?.isAdmin).toBe(false);
  });

  it("reads the token from a custom cookie name among others", async () => {
    const custom = firebaseAuth({
      adminEmails: ["admin@site.test"],
      cookieName: "session",
    });
    verifyIdToken.mockResolvedValueOnce({
      uid: "u1",
      email: "admin@site.test",
      admin: true,
    });
    const identity = await custom.verifyRequest(
      request("other=x; session=tok%3D1; theme=dark"),
    );
    expect(identity?.isAdmin).toBe(true);
    expect(verifyIdToken).toHaveBeenCalledWith("tok=1");
  });
});
