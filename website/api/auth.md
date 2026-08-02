# Auth

Firebase is the only provider that ships today. More are being added
gradually.

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
