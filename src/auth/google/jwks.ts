const GOOGLE_CERTS_URL = "https://www.googleapis.com/oauth2/v3/certs";

/** A Google JWKS entry (RSA public key in JWK form). */
export interface GoogleJwk {
  kid: string;
  kty: string;
  n: string;
  e: string;
  alg?: string;
  use?: string;
}

let keyCache: { keys: Map<string, GoogleJwk>; expiresAt: number } | null = null;

/** Fetch (and cache, honouring `cache-control: max-age`) Google's signing keys. */
export async function getSigningKey(kid: string): Promise<GoogleJwk | null> {
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

/** Drops the cached JWKS. Internal: the test seam, never an entry point export. */
export function resetGoogleKeyCache(): void {
  keyCache = null;
}
