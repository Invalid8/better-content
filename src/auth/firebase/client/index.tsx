"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type Auth,
  type GoogleAuthProvider,
  type User,
} from "firebase/auth";
import { CmsAuthProvider } from "better-content/react";

export interface FirebaseAuthProviderProps {
  children: ReactNode;
  auth: Auth;
  googleProvider?: GoogleAuthProvider;
  cookieName?: string;
  onLogout?: () => void;
}

interface FirebaseAuthContextValue {
  user: User | null;
  isAdmin: boolean;
  isEditing: boolean;
  toggleEdit: () => void;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const FirebaseAuthContext = createContext<FirebaseAuthContextValue | undefined>(
  undefined,
);

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/`;
}
function deleteCookie(name: string) {
  document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

export function FirebaseAuthProvider({
  children,
  auth,
  googleProvider,
  cookieName = "adminToken",
  onLogout,
}: FirebaseAuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setUser(null);
        setIsAdmin(false);
        deleteCookie(cookieName);
        return;
      }
      const tokenResult = await u.getIdTokenResult();
      const admin = !!tokenResult.claims.admin;
      if (!admin) {
        await signOut(auth);
        setUser(null);
        setIsAdmin(false);
        deleteCookie(cookieName);
        return;
      }
      setUser(u);
      setIsAdmin(true);
      setCookie(cookieName, tokenResult.token);
    });
    return () => unsubscribe();
  }, [auth, cookieName]);

  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const response = await originalFetch(...args);
      if (response.status === 401) {
        try {
          const data = await response.clone().json();
          if (data?.logout) {
            await signOut(auth);
            setUser(null);
            setIsAdmin(false);
            setIsEditing(false);
            deleteCookie(cookieName);
            onLogout?.();
          }
        } catch {
          /* not a JSON body */
        }
      }
      return response;
    };
    return () => {
      window.fetch = originalFetch;
    };
  }, [auth, cookieName, onLogout]);

  const requireAdminClaim = async (u: User) => {
    const tokenResult = await u.getIdTokenResult();
    if (!tokenResult.claims.admin) {
      await signOut(auth);
      throw new Error("Unauthorized");
    }
    setUser(u);
    setIsAdmin(true);
    setCookie(cookieName, tokenResult.token);
  };

  const loginWithGoogle = async () => {
    if (!googleProvider)
      throw new Error("FirebaseAuthProvider: googleProvider not configured");
    const result = await signInWithPopup(auth, googleProvider);
    await requireAdminClaim(result.user);
  };

  const loginWithEmail = async (email: string, password: string) => {
    const result = await signInWithEmailAndPassword(auth, email, password);
    await requireAdminClaim(result.user);
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
    setIsAdmin(false);
    setIsEditing(false);
    deleteCookie(cookieName);
  };

  const toggleEdit = () => setIsEditing((p) => !p);

  return (
    <FirebaseAuthContext.Provider
      value={{
        user,
        isAdmin,
        isEditing,
        toggleEdit,
        loginWithGoogle,
        loginWithEmail,
        logout,
      }}
    >
      <CmsAuthProvider value={{ isAdmin, isEditing, toggleEdit }}>
        {children}
      </CmsAuthProvider>
    </FirebaseAuthContext.Provider>
  );
}

export function useFirebaseAuth(): FirebaseAuthContextValue {
  const ctx = useContext(FirebaseAuthContext);
  if (!ctx)
    throw new Error(
      "useFirebaseAuth must be used within a FirebaseAuthProvider",
    );
  return ctx;
}
