import type { AuthAdapter, AuthorizeFn, DataAdapter } from "better-content/core";
import { createAdminGate } from "./createAdminGate";
import { loadItemMap, type ItemMapLoadConfig } from "./loadItemMap";
import {
  defaultOnError,
  errorResponse,
  json,
  type ErrorReporter,
} from "./http";

export interface ContentHandlerDeps {
  data: DataAdapter;
  /** Same shape `loadItemMap` takes: which collections to read, and how. */
  collections: ItemMapLoadConfig;
  /**
   * Gate the read as well. Omit for a public endpoint, which is the usual
   * case: this route only ever reads the content the page already renders.
   */
  auth?: AuthAdapter;
  authorize?: AuthorizeFn;
  /**
   * Cache-Control for successful responses. Defaults to `no-store`, because
   * the point of this route is that an edit shows up on the next load.
   */
  cacheControl?: string;
  /** Reports server-side failures; defaults to `console.error`. */
  onError?: ErrorReporter;
}

export type ContentRouteHandler = (req?: Request) => Promise<Response>;

/**
 * The public read half of the CMS.
 *
 * `createCmsHandlers` covers writes, and its GET is admin-gated and fetches a
 * single document by id, so it cannot answer "give me the content for this
 * page". Anything rendering on the client needs this: an endpoint returning
 * the same `ItemMap` a server-rendered page would have loaded.
 *
 * Pair it with `fetchItemMap` on the client.
 */
export function createContentHandler(deps: ContentHandlerDeps): {
  GET: ContentRouteHandler;
} {
  const {
    data,
    collections,
    auth,
    authorize,
    cacheControl = "no-store",
    onError = defaultOnError,
  } = deps;

  const requireAdmin = auth ? createAdminGate(auth, authorize) : undefined;

  const GET: ContentRouteHandler = async (req) => {
    try {
      if (requireAdmin) {
        if (!req) {
          throw new Error(
            "createContentHandler was configured with `auth` but the handler was called without a Request, so the gate cannot run.",
          );
        }
        await requireAdmin(req);
      }

      const items = await loadItemMap(data, collections);
      const res = json(items);
      res.headers.set("Cache-Control", cacheControl);
      return res;
    } catch (error) {
      return errorResponse(error, onError);
    }
  };

  return { GET };
}
