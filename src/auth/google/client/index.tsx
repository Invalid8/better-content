"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  GoogleLogin,
  GoogleOAuthProvider,
  googleLogout,
  useGoogleOneTapLogin,
  type CredentialResponse,
  type GoogleLoginProps,
} from "@react-oauth/google";
import { CmsAuthProvider } from "better-content/react";

/**
 * Client provider for **Google sign-in**, built on `@react-oauth/google` (the
 * official React wrapper for Google Identity Services). The resulting ID token
 * is stashed in a cookie for the server `googleAuth` adapter to verify; admin
 * status is optimistic on the client, with the server gate authoritative.
 *
 * Nothing here forces you into Google's button. Three ways to sign in:
 *
 * - `<GoogleSignInButton />` renders Google's official button, and forwards
 *   every option Google exposes.
 * - `oneTap` on the provider shows Google's One Tap prompt, so there is no
 *   button at all.
 * - `useGoogleAuth().applyCredential(idToken)` accepts a credential you
 *   obtained yourself, so you can render whatever UI you like and run your own
 *   flow.
 *
 * The one thing you cannot do is style Google's button beyond the options it
 * offers: it renders in an iframe that Google owns. An ID token comes only
 * from that button or from One Tap, so a fully bespoke button means running
 * the auth-code flow yourself and handing the result to `applyCredential`.
 */

export interface GoogleUser {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
}

export interface GoogleAuthProviderProps {
  children: ReactNode;
  /** OAuth 2.0 Web client ID (from Google Cloud Console, Credentials). */
  clientId: string;
  /**
   * Optional admin allowlist for *optimistic* client-side `isAdmin`. The server
   * `googleAuth` adapter still enforces the real gate. Omit to treat any
   * successful sign-in as optimistically admin (the server corrects via 401).
   */
  adminEmails?: string[];
  /** Cookie name for the ID token. Default `adminToken`. */
  cookieName?: string;
  /** Show Google's One Tap prompt, so no sign-in button is needed. */
  oneTap?: boolean;
  /** Called when a 401 `{ logout: true }` response is intercepted. */
  onLogout?: () => void;
}

export interface GoogleAuthContextValue {
  user: GoogleUser | null;
  isAdmin: boolean;
  isEditing: boolean;
  toggleEdit: () => void;
  logout: () => void;
  /**
   * Feed in a Google ID token. `GoogleSignInButton` and One Tap call this for
   * you; call it yourself when you run your own flow and render your own UI.
   */
  applyCredential: (credential: string) => void;
}

const GoogleAuthContext = createContext<GoogleAuthContextValue | undefined>(
  undefined,
);

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; samesite=lax`;
}
function deleteCookie(name: string) {
  document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}
function readCookie(name: string): string | null {
  for (const part of document.cookie.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

/** Decode a JWT payload client-side. No verification: the server does that. */
function decodeJwt(token: string): (GoogleUser & { exp?: number }) | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function OneTap() {
  const { applyCredential } = useGoogleAuth();
  useGoogleOneTapLogin({
    onSuccess: (res: CredentialResponse) => {
      if (res.credential) applyCredential(res.credential);
    },
  });
  return null;
}

function AuthState({
  children,
  adminEmails,
  cookieName = "adminToken",
  oneTap,
  onLogout,
}: Omit<GoogleAuthProviderProps, "clientId">) {
  const [user, setUser] = useState<GoogleUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const allowed = useRef(
    (adminEmails ?? []).map((e) => e.trim().toLowerCase()),
  );

  const applyCredential = useCallback(
    (token: string) => {
      const claims = decodeJwt(token);
      if (!claims) return;
      if (claims.exp && claims.exp * 1000 <= Date.now()) {
        deleteCookie(cookieName);
        return;
      }
      const email = claims.email?.toLowerCase();
      // Optimistic: with no allowlist, trust the sign-in and let the server
      // correct a non-admin through the 401 interceptor below.
      const admin =
        allowed.current.length === 0
          ? true
          : !!email && allowed.current.includes(email);
      setCookie(cookieName, token);
      // Built up rather than declared inline: exactOptionalPropertyTypes
      // distinguishes "absent" from "present and undefined".
      const next: GoogleUser = { sub: claims.sub };
      if (claims.email !== undefined) next.email = claims.email;
      if (claims.name !== undefined) next.name = claims.name;
      if (claims.picture !== undefined) next.picture = claims.picture;
      setUser(next);
      setIsAdmin(admin);
    },
    [cookieName],
  );

  // Restore an existing session from the cookie on mount.
  useEffect(() => {
    const existing = readCookie(cookieName);
    if (existing) applyCredential(existing);
  }, [cookieName, applyCredential]);

  const logout = useCallback(() => {
    googleLogout();
    deleteCookie(cookieName);
    setUser(null);
    setIsAdmin(false);
    setIsEditing(false);
    onLogout?.();
  }, [cookieName, onLogout]);

  // Intercept admin 401s so an expired or forbidden session forces sign-out.
  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const response = await originalFetch(...args);
      if (response.status === 401) {
        try {
          const data = await response.clone().json();
          if (data?.logout) logout();
        } catch {
          /* not a JSON body, ignore */
        }
      }
      return response;
    };
    return () => {
      window.fetch = originalFetch;
    };
  }, [logout]);

  const toggleEdit = useCallback(() => setIsEditing((p) => !p), []);

  return (
    <GoogleAuthContext.Provider
      value={{ user, isAdmin, isEditing, toggleEdit, logout, applyCredential }}
    >
      <CmsAuthProvider value={{ isAdmin, isEditing, toggleEdit }}>
        {oneTap ? <OneTap /> : null}
        {children}
      </CmsAuthProvider>
    </GoogleAuthContext.Provider>
  );
}

export function GoogleAuthProvider({
  children,
  clientId,
  ...rest
}: GoogleAuthProviderProps) {
  return (
    <GoogleOAuthProvider clientId={clientId}>
      <AuthState {...rest}>{children}</AuthState>
    </GoogleOAuthProvider>
  );
}

/**
 * Every option Google's button takes, minus the ones we own (`onSuccess`
 * feeds `applyCredential`; `useOneTap` is the provider's `oneTap` prop).
 * Google renders this in an iframe, so its own options are the full extent of
 * what can be restyled. For UI Google does not offer, run your own flow and
 * call `applyCredential`.
 */
export type GoogleSignInButtonProps = Omit<
  GoogleLoginProps,
  "onSuccess" | "useOneTap"
>;

/** The official Google sign-in button. Must be rendered inside a provider. */
export function GoogleSignInButton(props: GoogleSignInButtonProps) {
  const { applyCredential } = useGoogleAuth();
  return (
    <GoogleLogin
      {...props}
      onSuccess={(res: CredentialResponse) => {
        if (res.credential) applyCredential(res.credential);
      }}
    />
  );
}

/** Google auth API (user, logout, applyCredential) for login pages and toolbars. */
export function useGoogleAuth(): GoogleAuthContextValue {
  const ctx = useContext(GoogleAuthContext);
  if (!ctx) {
    throw new Error("useGoogleAuth must be used within a GoogleAuthProvider");
  }
  return ctx;
}
