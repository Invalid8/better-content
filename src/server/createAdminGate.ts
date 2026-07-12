import type {
  AuthAdapter,
  AuthIdentity,
  AuthorizeFn,
} from "better-content/core";

export class UnauthorizedError extends Error {
  readonly status: 401 | 403;

  constructor(message = "Unauthorized", status: 401 | 403 = 401) {
    super(message);
    this.name = "UnauthorizedError";
    this.status = status;
  }
}

const defaultAuthorize: AuthorizeFn = (identity) => identity.isAdmin === true;

export function createAdminGate(
  auth: AuthAdapter,
  authorize: AuthorizeFn = defaultAuthorize,
) {
  return async function requireAdmin(req: Request): Promise<AuthIdentity> {
    const identity = await auth.verifyRequest(req);
    if (!identity) {
      throw new UnauthorizedError("Unauthorized");
    }
    if (!(await authorize(identity, req))) {
      throw new UnauthorizedError("Forbidden - Not an authorized admin", 403);
    }
    return identity;
  };
}
