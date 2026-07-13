import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import type { AuthAdapter, AuthIdentity } from "better-content/core";

export interface FirebaseAuthConfig {
  adminEmails: string[];
  cookieName?: string;
  credentials?: {
    projectId?: string;
    clientEmail?: string;
    privateKey?: string;
    databaseURL?: string;
  };
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

export function firebaseAuth(config: FirebaseAuthConfig): AuthAdapter {
  const cookieName = config.cookieName ?? "adminToken";
  const allowed = config.adminEmails.map((e) => e.trim());

  if (!getApps().length && config.credentials) {
    const c = config.credentials;
    initializeApp({
      credential: cert({
        ...(c.projectId !== undefined && { projectId: c.projectId }),
        ...(c.clientEmail !== undefined && { clientEmail: c.clientEmail }),
        ...(c.privateKey !== undefined && { privateKey: c.privateKey }),
      }),
      ...(c.databaseURL !== undefined && { databaseURL: c.databaseURL }),
    });
  }

  return {
    async verifyRequest(req: Request): Promise<AuthIdentity | null> {
      const token = readCookie(req, cookieName);
      if (!token) return null;

      let decoded;
      try {
        decoded = await getAuth().verifyIdToken(token);
      } catch {
        return null;
      }

      const isAdmin = !!decoded.admin && allowed.includes(decoded.email ?? "");

      return {
        userId: decoded.uid,
        ...(decoded.email !== undefined && { email: decoded.email }),
        isAdmin,
      };
    },
  };
}
