import type {
  AuthAdapter,
  AuthorizeFn,
  DataAdapter,
  ServerStorageAdapter,
} from "better-content/core";
import { createAdminGate, UnauthorizedError } from "./createAdminGate";

export interface CmsHandlersDeps {
  data: DataAdapter;
  auth: AuthAdapter;
  storage?: ServerStorageAdapter;
  authorize?: AuthorizeFn;
}

type RouteContext = {
  params: Promise<{ collection: string; id: string }>;
};

type RouteHandler = (req: Request, ctx: RouteContext) => Promise<Response>;
type SignHandler = (req: Request) => Promise<Response>;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

class BadRequestError extends Error {}

async function readObjectBody(req: Request): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new BadRequestError("Request body must be valid JSON");
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new BadRequestError("Request body must be a JSON object");
  }
  return body as Record<string, unknown>;
}

function errorResponse(error: unknown): Response {
  if (error instanceof UnauthorizedError) {
    if (error.status === 401) {
      return json({ error: error.message, logout: true }, 401);
    }
    return json({ error: error.message }, 403);
  }
  if (error instanceof BadRequestError) {
    return json({ error: error.message }, 400);
  }
  const message = error instanceof Error ? error.message : "Request failed";
  return json({ error: message }, 500);
}

export function createCmsHandlers(deps: CmsHandlersDeps): {
  GET: RouteHandler;
  PATCH: RouteHandler;
  PUT: RouteHandler;
  DELETE: RouteHandler;
  sign: SignHandler;
} {
  const { data, auth, storage, authorize } = deps;
  const requireAdmin = createAdminGate(auth, authorize);

  const GET: RouteHandler = async (req, ctx) => {
    try {
      await requireAdmin(req);
      const { collection, id } = await ctx.params;
      const doc = await data.fetchById(collection, id);
      if (!doc) return json({ error: "Document not found" }, 404);
      return json(doc);
    } catch (error) {
      return errorResponse(error);
    }
  };

  const PATCH: RouteHandler = async (req, ctx) => {
    try {
      await requireAdmin(req);
      const { collection, id } = await ctx.params;
      const body = await readObjectBody(req);
      await data.update(collection, id, body);
      return json({ ok: true });
    } catch (error) {
      return errorResponse(error);
    }
  };

  const PUT: RouteHandler = async (req, ctx) => {
    try {
      await requireAdmin(req);
      const { collection, id } = await ctx.params;
      const body = await readObjectBody(req);
      await data.upsert(collection, id, body);
      return json({ ok: true });
    } catch (error) {
      return errorResponse(error);
    }
  };

  const DELETE: RouteHandler = async (req, ctx) => {
    try {
      await requireAdmin(req);
      const { collection, id } = await ctx.params;
      await data.delete(collection, id);
      return json({ ok: true });
    } catch (error) {
      return errorResponse(error);
    }
  };

  const sign: SignHandler = async (req) => {
    try {
      await requireAdmin(req);
      if (!storage?.sign) {
        return json({ error: "No storage adapter with sign() configured" }, 404);
      }
      const result = await storage.sign(req);
      return json(result);
    } catch (error) {
      return errorResponse(error);
    }
  };

  return { GET, PATCH, PUT, DELETE, sign };
}
