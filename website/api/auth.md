# Auth

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
