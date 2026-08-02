import { generateKeyPairSync, createSign, type KeyObject } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  googleAuth,
  resetGoogleKeyCache,
  verifyGoogleIdToken,
} from "../src/auth/google";

const CLIENT_ID = "1234.apps.googleusercontent.com";
const KID = "test-key";

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
});

const b64url = (buf: Buffer | string) =>
  Buffer.from(buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

function sign(
  payload: Record<string, unknown>,
  {
    kid = KID,
    alg = "RS256",
    key = privateKey,
  }: { kid?: string; alg?: string; key?: KeyObject } = {},
) {
  const header = b64url(JSON.stringify({ alg, kid, typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${body}`);
  signer.end();
  return `${header}.${body}.${b64url(signer.sign(key))}`;
}

const validPayload = (over: Record<string, unknown> = {}) => ({
  iss: "https://accounts.google.com",
  aud: CLIENT_ID,
  sub: "user-1",
  exp: Math.floor(Date.now() / 1000) + 3600,
  iat: Math.floor(Date.now() / 1000),
  email: "owner@example.com",
  email_verified: true,
  ...over,
});

// Google's JWKS, served from our throwaway key.
const jwks = () => {
  const jwk = publicKey.export({ format: "jwk" }) as Record<string, unknown>;
  return new Response(JSON.stringify({ keys: [{ ...jwk, kid: KID }] }), {
    status: 200,
    headers: { "cache-control": "max-age=3600" },
  });
};

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  resetGoogleKeyCache();
  fetchMock = vi.fn(async () => jwks());
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const withCookie = (value: string) =>
  new Request("http://test/api/admin/sections/hero", {
    headers: { cookie: `adminToken=${value}` },
  });

describe("verifyGoogleIdToken", () => {
  it("accepts a correctly signed, current token", async () => {
    const payload = await verifyGoogleIdToken(sign(validPayload()), {
      clientId: CLIENT_ID,
    });
    expect(payload.email).toBe("owner@example.com");
    expect(payload.sub).toBe("user-1");
  });

  it("rejects a token whose signature does not match", async () => {
    const other = generateKeyPairSync("rsa", { modulusLength: 2048 });
    await expect(
      verifyGoogleIdToken(sign(validPayload(), { key: other.privateKey }), {
        clientId: CLIENT_ID,
      }),
    ).rejects.toThrow(/Invalid ID token signature/);
  });

  it("rejects an expired token", async () => {
    const expired = validPayload({ exp: Math.floor(Date.now() / 1000) - 10 });
    await expect(
      verifyGoogleIdToken(sign(expired), { clientId: CLIENT_ID }),
    ).rejects.toThrow(/expired/);
  });

  it("rejects an untrusted issuer", async () => {
    await expect(
      verifyGoogleIdToken(sign(validPayload({ iss: "https://evil.example" })), {
        clientId: CLIENT_ID,
      }),
    ).rejects.toThrow(/Untrusted issuer/);
  });

  // A token minted for a different app is a real attack, not a typo.
  it("rejects a token issued for another client id", async () => {
    await expect(
      verifyGoogleIdToken(sign(validPayload({ aud: "9999.apps.googleusercontent.com" })), {
        clientId: CLIENT_ID,
      }),
    ).rejects.toThrow(/Audience mismatch/);
  });

  it("accepts any of several client ids", async () => {
    await expect(
      verifyGoogleIdToken(sign(validPayload()), {
        clientId: ["other.apps.googleusercontent.com", CLIENT_ID],
      }),
    ).resolves.toMatchObject({ aud: CLIENT_ID });
  });

  // "alg": "none" is the classic JWT forgery.
  it("rejects a non-RS256 algorithm", async () => {
    await expect(
      verifyGoogleIdToken(sign(validPayload(), { alg: "none" }), {
        clientId: CLIENT_ID,
      }),
    ).rejects.toThrow(/Unexpected alg/);
  });

  it("rejects a token signed with an unknown key id", async () => {
    await expect(
      verifyGoogleIdToken(sign(validPayload(), { kid: "not-google" }), {
        clientId: CLIENT_ID,
      }),
    ).rejects.toThrow(/No matching Google signing key/);
  });

  it("rejects a malformed token", async () => {
    for (const bad of ["", "a.b", "a.b.c.d"]) {
      await expect(
        verifyGoogleIdToken(bad, { clientId: CLIENT_ID }),
      ).rejects.toThrow(/Malformed ID token/);
    }
  });

  it("caches the JWKS across verifications", async () => {
    await verifyGoogleIdToken(sign(validPayload()), { clientId: CLIENT_ID });
    await verifyGoogleIdToken(sign(validPayload()), { clientId: CLIENT_ID });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});

describe("googleAuth", () => {
  const auth = () =>
    googleAuth({ clientId: CLIENT_ID, adminEmails: ["Owner@Example.com"] });

  it("grants admin to a verified allowlisted email", async () => {
    const identity = await auth().verifyRequest(withCookie(sign(validPayload())));
    expect(identity).toMatchObject({ isAdmin: true, email: "owner@example.com" });
  });

  it("matches the allowlist case-insensitively", async () => {
    const identity = await auth().verifyRequest(
      withCookie(sign(validPayload({ email: "OWNER@EXAMPLE.COM" }))),
    );
    expect(identity?.isAdmin).toBe(true);
  });

  // Anyone can create a Google account claiming an address; only the
  // email_verified claim says Google checked it.
  it("refuses admin when the email is not verified", async () => {
    const identity = await auth().verifyRequest(
      withCookie(sign(validPayload({ email_verified: false }))),
    );
    expect(identity?.isAdmin).toBe(false);
  });

  it("refuses admin to an email off the allowlist", async () => {
    const identity = await auth().verifyRequest(
      withCookie(sign(validPayload({ email: "someone@example.com" }))),
    );
    expect(identity?.isAdmin).toBe(false);
  });

  it("returns null with no cookie, so the gate answers 401", async () => {
    const bare = new Request("http://test/api/admin/sections/hero");
    await expect(auth().verifyRequest(bare)).resolves.toBeNull();
  });

  it("returns null for an invalid token rather than throwing", async () => {
    const expired = sign(validPayload({ exp: Math.floor(Date.now() / 1000) - 10 }));
    await expect(auth().verifyRequest(withCookie(expired))).resolves.toBeNull();
  });

  it("honours a custom cookie name", async () => {
    const adapter = googleAuth({
      clientId: CLIENT_ID,
      adminEmails: ["owner@example.com"],
      cookieName: "session",
    });
    const req = new Request("http://test/x", {
      headers: { cookie: `session=${sign(validPayload())}` },
    });
    expect((await adapter.verifyRequest(req))?.isAdmin).toBe(true);
  });
});
