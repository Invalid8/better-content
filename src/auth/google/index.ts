import { createPublicKey, createVerify } from "node:crypto";
import type { AuthAdapter, AuthIdentity } from "better-content/core";

/**
 * Server auth adapter backed by **Google Identity Services** ID tokens: the
 * lightweight alternative to the Firebase adapter when all you want is "Sign in
 * with Google". No Firebase project and no service account. The browser obtains
 * a signed Google ID token (a JWT), drops it in a cookie, and this adapter
 * verifies it locally against Google's public keys, then gates on an email
 * allowlist.
 *
 * Verification uses Node's built-in crypto and fetch, so it adds no runtime
 * dependency.
 */

const GOOGLE_CERTS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

/** A Google JWKS entry (RSA public key in JWK form). */
interface GoogleJwk {
  kid: string;
  kty: string;
  n: string;
  e: string;
  alg?: string;
  use?: string;
}

let keyCache: { keys: Map<string, GoogleJwk>; expiresAt: number } | null = null;

/** Fetch (and cache, honouring `cache-control: max-age`) Google's signing keys. */
async function getSigningKey(kid: string): Promise<GoogleJwk | null> {
  const now = Date.now();
  if (!keyCache || now >= keyCache.expiresAt) {
    const res = await fetch(GOOGLE_CERTS_URL);
    if (!res.ok) throw new Error(`Google JWKS fetch failed: ${res.status}`);
    const body = (await res.json()) as { keys: GoogleJwk[] };
    const keys = new Map(body.keys.map((k) => [k.kid, k]));
    const maxAge = /max-age=(\d+)/.exec(res.headers.get("cache-control") ?? "");
    keyCache = {
      keys,
      expiresAt: now + (maxAge ? Number(maxAge[1]) * 1000 : 3_600_000),
    };
  }
  return keyCache.keys.get(kid) ?? null;
}

/** Drops the cached JWKS. Exported for tests; production honours max-age. */
export function resetGoogleKeyCache(): void {
  keyCache = null;
}

function b64urlToBuffer(input: string): Buffer {
  return Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function b64urlToJson<T>(input: string): T {
  return JSON.parse(b64urlToBuffer(input).toString("utf8")) as T;
}

function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

/** Claims of interest from a verified Google ID token. */
export interface GoogleIdTokenPayload {
  iss: string;
  aud: string;
  sub: string;
  exp: number;
  iat: number;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
}

export interface VerifyGoogleIdTokenOptions {
  /** Expected audience: your OAuth 2.0 Web client ID(s). */
  clientId: string | string[];
  /** Accepted issuers. Defaults to Google's two canonical issuers. */
  issuers?: string[];
  /** Clock injection for tests. Defaults to `Date.now`. */
  now?: () => number;
}

/**
 * Verify a Google ID token end to end: RS256 signature against Google's JWKS,
 * plus `exp` / `iss` / `aud` checks. Throws on any failure; resolves with the
 * decoded payload on success. Exported standalone for custom flows and tests.
 */
export async function verifyGoogleIdToken(
  token: string,
  opts: VerifyGoogleIdTokenOptions,
): Promise<GoogleIdTokenPayload> {
  const [headerB64, payloadB64, signatureB64, ...rest] = token.split(".");
  if (!headerB64 || !payloadB64 || !signatureB64 || rest.length) {
    throw new Error("Malformed ID token");
  }

  const header = b64urlToJson<{ alg: string; kid: string }>(headerB64);
  if (header.alg !== "RS256") throw new Error(`Unexpected alg: ${header.alg}`);

  const jwk = await getSigningKey(header.kid);
  if (!jwk) throw new Error("No matching Google signing key for token");

  const publicKey = createPublicKey({
    key: jwk as unknown as Record<string, unknown>,
    format: "jwk",
  } as Parameters<typeof createPublicKey>[0]);
  const verifier = createVerify("RSA-SHA256");
  verifier.update(`${headerB64}.${payloadB64}`);
  verifier.end();
  if (!verifier.verify(publicKey, b64urlToBuffer(signatureB64))) {
    throw new Error("Invalid ID token signature");
  }

  const payload = b64urlToJson<GoogleIdTokenPayload>(payloadB64);
  const nowSec = Math.floor((opts.now?.() ?? Date.now()) / 1000);
  if (payload.exp <= nowSec) throw new Error("ID token expired");

  const issuers = opts.issuers ?? GOOGLE_ISSUERS;
  if (!issuers.includes(payload.iss)) {
    throw new Error(`Untrusted issuer: ${payload.iss}`);
  }
  const audiences = Array.isArray(opts.clientId)
    ? opts.clientId
    : [opts.clientId];
  if (!audiences.includes(payload.aud)) throw new Error("Audience mismatch");

  return payload;
}

export interface GoogleAuthConfig {
  /** OAuth 2.0 Web client ID(s); the token's `aud` must match one of these. */
  clientId: string | string[];
  /** Allowlist of admin emails (compared case-insensitively). */
  adminEmails: string[];
  /** Cookie carrying the Google ID token. Default `adminToken`. */
  cookieName?: string;
  /** Accepted issuers (override for testing). */
  issuers?: string[];
}

/**
 * Build an {@link AuthAdapter} that verifies the Google ID token from the
 * request cookie and grants admin only to a verified email in `adminEmails`.
 */
export function googleAuth(config: GoogleAuthConfig): AuthAdapter {
  const cookieName = config.cookieName ?? "adminToken";
  const allowed = config.adminEmails.map((e) => e.trim().toLowerCase());

  return {
    async verifyRequest(req: Request): Promise<AuthIdentity | null> {
      const token = readCookie(req, cookieName);
      if (!token) return null;

      let payload: GoogleIdTokenPayload;
      try {
        payload = await verifyGoogleIdToken(token, {
          clientId: config.clientId,
          ...(config.issuers ? { issuers: config.issuers } : {}),
        });
      } catch {
        // Expired, invalid or tampered: unauthorized, so the gate emits a
        // 401 { logout: true } and the client can force sign-out.
        return null;
      }

      const email = payload.email?.toLowerCase();
      const isAdmin =
        !!email && payload.email_verified === true && allowed.includes(email);

      return {
        userId: payload.sub,
        ...(payload.email ? { email: payload.email } : {}),
        isAdmin,
      };
    },
  };
}
