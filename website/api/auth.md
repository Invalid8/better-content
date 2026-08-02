# Auth

Firebase and Google ship today. More are being added gradually.

That is not a limit on what you can use. Auth reaches the library through one
small interface, [`AuthAdapter`](/api/core#seam-interfaces), and
`createCmsHandlers` only ever calls `verifyRequest`:

```ts
import type { AuthAdapter } from "better-content/core";

export const auth: AuthAdapter = {
  async verifyRequest(req) {
    // however you decide: a signed cookie, a session lookup, an OIDC token
    return isAdmin(req) ? { isAdmin: true } : null;
  },
};
```

Return `null` for "not an admin" and the gate answers 401 `{ logout: true }`.
Anything you can check inside a `Request` on your server can back it, so
NextAuth, Auth.js, Clerk, Lucia, or a plain admin token are all a handful of
lines. The token gate that `create-better-content` generates is exactly this,
and worth reading as a template.

## better-content/auth/firebase (server)

```ts
function firebaseAuth(config: FirebaseAuthConfig): AuthAdapter;

interface FirebaseAuthConfig {
  adminEmails: string[];    // allowlist; required
  cookieName?: string;      // default "adminToken"
  credentials?: {           // used only if firebase-admin is not initialized
    projectId?: string;
    clientEmail?: string;
    privateKey?: string;
    databaseURL?: string;
  };
}
```

`verifyRequest` reads the ID token from the cookie and verifies it with
firebase-admin (modular API). The resolved identity is admin only when the
token carries the `admin` custom claim **and** its email is in
`adminEmails`. Missing or invalid tokens resolve to `null` (the gate turns
that into 401 `{ logout: true }`).

Peer: `firebase-admin` >= 12.

## better-content/auth/firebase/client

```tsx
function FirebaseAuthProvider(props: {
  children: ReactNode;
  auth: Auth;                          // your firebase/auth instance
  googleProvider?: GoogleAuthProvider; // enables loginWithGoogle
  cookieName?: string;                 // default "adminToken"
  onLogout?: () => void;               // called on forced sign-out
}): JSX.Element;

function useFirebaseAuth(): {
  user: User | null;
  isAdmin: boolean;
  isEditing: boolean;
  toggleEdit(): void;
  loginWithGoogle(): Promise<void>;
  loginWithEmail(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
};
```

Behavior:

- keeps the token cookie in sync with the Firebase auth lifecycle,
- rejects sign-ins whose token lacks the `admin` claim (signs the user back
  out and throws),
- feeds the shared `CmsAuthContext`, so the editing primitives see
  `isAdmin`/`isEditing` without extra wiring,
- intercepts `fetch` responses: a 401 with `{ logout: true }` forces
  sign-out and calls `onLogout`.

Peers: `firebase` >= 10, `react` >= 18.

## better-content/auth/google (server)

```ts
function googleAuth(config: GoogleAuthConfig): AuthAdapter;

interface GoogleAuthConfig {
  clientId: string | string[];   // OAuth 2.0 Web client ID(s); must match the token's `aud`
  adminEmails: string[];         // allowlist, compared case-insensitively
  cookieName?: string;           // default "adminToken"
  issuers?: string[];            // override for testing
}

// exported standalone for custom flows and tests
function verifyGoogleIdToken(token: string, opts: {
  clientId: string | string[];
  issuers?: string[];
  now?: () => number;
}): Promise<GoogleIdTokenPayload>;
```

Sign in with Google without a Firebase project or a service account. The
browser gets a Google ID token, drops it in a cookie, and this adapter
verifies it locally: RS256 against Google's published JWKS, plus `exp`,
`iss` and `aud` checks. The JWKS is cached according to Google's own
`cache-control`.

A request is admin only when the signature verifies **and** `email_verified`
is true **and** the email is in `adminEmails`. All three, because anyone can
create a Google account claiming an address; only `email_verified` says Google
checked it.

Invalid or expired tokens resolve to `null` rather than throwing, so the gate
turns them into 401 `{ logout: true }` and the client signs out.

No runtime dependency: Node's built-in crypto and `fetch`. Total config is one
client ID and an allowlist.

## better-content/auth/google/client

```tsx
<GoogleAuthProvider
  clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!}
  adminEmails={["you@example.com"]}   // optional, optimistic client-side isAdmin
  oneTap                              // optional, show One Tap instead of a button
>
  {children}
</GoogleAuthProvider>

function useGoogleAuth(): {
  user: GoogleUser | null;
  isAdmin: boolean;
  isEditing: boolean;
  toggleEdit: () => void;
  logout: () => void;
  applyCredential: (idToken: string) => void;
};
```

Wraps `CmsAuthProvider`, so the edit primitives read `isEditing` from it as
usual. `adminEmails` here is optimistic UI only; the server adapter is the real
gate, and a 401 `{ logout: true }` from any admin route forces sign-out.

### Choosing the sign-in UI

You are not tied to Google's button. Three options, and the reason there are
three is that an ID token can only come from Google's own button or One Tap:

```tsx
// 1. Google's official button. Every option Google exposes is forwarded:
//    theme, shape, size, text, width, logo_alignment, type, containerProps…
<GoogleSignInButton width={320} shape="pill" logo_alignment="center" />

// 2. No button at all.
<GoogleAuthProvider clientId={id} oneTap>

// 3. Your own UI. Run any flow you like, then hand over the credential.
const { applyCredential } = useGoogleAuth();
applyCredential(idToken);
```

Google renders its button in an iframe it controls, so its own options are the
full extent of what can be restyled there. If you need markup Google does not
offer, use option 3: run the auth-code flow yourself, exchange the code for an
ID token on your server, and call `applyCredential`.

Peer: `@react-oauth/google` >= 0.12 (optional; only needed for this entry
point).
