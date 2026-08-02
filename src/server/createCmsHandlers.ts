import type {
  AuthAdapter,
  AuthorizeFn,
  DataAdapter,
  ServerStorageAdapter,
} from "better-content/core";
import { createAdminGate } from "./createAdminGate";
import {
  defaultOnError,
  errorResponse,
  json,
  readObjectBody,
  type ErrorReporter,
} from "./http";

export interface CmsHandlersDeps {
  data: DataAdapter;
  auth: AuthAdapter;
  storage?: ServerStorageAdapter;
  authorize?: AuthorizeFn;
  /** Reports server-side failures; defaults to `console.error`. */
  onError?: ErrorReporter;
}

type RouteContext = {
  params: Promise<{ collection: string; id: string }>;
};

type RouteHandler = (req: Request, ctx: RouteContext) => Promise<Response>;
type SignHandler = (req: Request) => Promise<Response>;

export function createCmsHandlers(deps: CmsHandlersDeps): {
  GET: RouteHandler;
  PATCH: RouteHandler;
  PUT: RouteHandler;
  DELETE: RouteHandler;
  sign: SignHandler;
} {
  const { data, auth, storage, authorize, onError = defaultOnError } = deps;
  const requireAdmin = createAdminGate(auth, authorize);

  const GET: RouteHandler = async (req, ctx) => {
    try {
      await requireAdmin(req);
      const { collection, id } = await ctx.params;
      const doc = await data.fetchById(collection, id);
      if (!doc) return json({ error: "Document not found" }, 404);
      return json(doc);
    } catch (error) {
      return errorResponse(error, onError);
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
      return errorResponse(error, onError);
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
      return errorResponse(error, onError);
    }
  };

  const DELETE: RouteHandler = async (req, ctx) => {
    try {
      await requireAdmin(req);
      const { collection, id } = await ctx.params;
      await data.delete(collection, id);
      return json({ ok: true });
    } catch (error) {
      return errorResponse(error, onError);
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
      return errorResponse(error, onError);
    }
  };

  return { GET, PATCH, PUT, DELETE, sign };
}
