# Auth and the admin gate

Auth answers one question per request: **who is this, and may they write?**
Everything else is composition.

## The server side

```ts
interface AuthAdapter {
  verifyRequest(req: Request): Promise<AuthIdentity | null>;
}

interface AuthIdentity {
  isAdmin: boolean;
  userId?: string;
  email?: string;
  [claim: string]: unknown;   // carry roles, scopes, tenants...
}
```

Return `null` for requests you cannot verify. The route factory wraps your
adapter in a gate:

- unverified request: **401** with body `{ error, logout: true }`, a signal
  client interceptors use to force sign-out of stale sessions,
- verified but not authorized: **403**.

By default authorization means `identity.isAdmin === true`. Pass a custom
predicate for anything richer:

```ts
createCmsHandlers({
  data,
  auth,
  authorize: (identity) => identity.role === "editor",
});
```

`createAdminGate(auth, authorize?)` is exported separately, so you can guard
your own routes with the same semantics.

## Firebase, built in

```ts
import { firebaseAuth } from "better-content/auth/firebase";

const auth = firebaseAuth({
  adminEmails: ["you@example.com"],
  cookieName: "adminToken",            // default
  credentials: { projectId, clientEmail, privateKey }, // if admin SDK not yet initialized
});
```

It reads a Firebase ID token from the cookie and verifies it with
firebase-admin. Admin requires **both** the `admin` custom claim on the
token **and** membership in the `adminEmails` allowlist; either alone is not
enough. Expired or invalid tokens resolve to `null`, which becomes the 401
logout signal.

The matching client half:

```tsx
import { FirebaseAuthProvider, useFirebaseAuth } from "better-content/auth/firebase/client";

<FirebaseAuthProvider auth={firebaseAuth} googleProvider={googleProvider}>
  <App />
</FirebaseAuthProvider>
```

It manages the token cookie through the auth lifecycle, rejects sign-ins
that lack the admin claim, feeds the shared `CmsAuthContext` so the editing
primitives see `isAdmin`/`isEditing`, and installs a fetch interceptor that
force-signs-out when any response is a 401 with `{ logout: true }`.
`useFirebaseAuth()` exposes `loginWithGoogle`, `loginWithEmail`, `logout`,
and the current `user`.

## Anonymous edit mode

```tsx
import { AnonymousEditProvider } from "better-content/react";
```

Local-only edit state: visitors can toggle edit mode and type on the page,
but `isAdmin` stays false and the server gate rejects every write. This is
the try-the-CMS-on-the-live-site pattern; the visitor experiences inline
editing with zero risk to your data. The
[live demo](https://better-content-playground.vercel.app) is built on it.

The important property: **edit mode is a client convenience, the gate is
the security boundary.** Nothing about hiding the edit toggle protects your
data; `verifyRequest` does.

## Bringing your own auth

Two pieces, both small:

1. Server: implement `verifyRequest` against your session mechanism
   (NextAuth session, JWT, your own cookies).
2. Client: provide `CmsAuthState` through `CmsAuthProvider`:

```tsx
const [isEditing, setIsEditing] = useState(false);

<CmsAuthProvider value={{
  isAdmin: session?.user.role === "admin",
  isEditing,
  toggleEdit: () => setIsEditing(v => !v),
}}>
```
