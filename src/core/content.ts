import type { ItemMap } from "./types";

export interface FetchItemMapOptions {
  /** Defaults to the global `fetch`. Pass one in for tests or SSR. */
  fetch?: typeof globalThis.fetch;
  signal?: AbortSignal;
  headers?: HeadersInit;
}

/**
 * Read a content snapshot over HTTP, for apps with no server of their own.
 *
 * A `Transport` only writes. Server-rendered apps read through `loadItemMap`,
 * which needs a `DataAdapter` and so cannot run in a browser. This is the
 * client-side counterpart: point it at a `createContentHandler` route and hand
 * the result to `createCmsEngine` as `initialItems`.
 */
export async function fetchItemMap(
  url: string,
  options: FetchItemMapOptions = {},
): Promise<ItemMap> {
  const impl = options.fetch ?? globalThis.fetch;

  if (typeof impl !== "function") {
    throw new Error(
      "fetchItemMap needs a fetch implementation: this runtime has no global fetch, so pass one in options.",
    );
  }

  // Headers rather than a spread: HeadersInit is a union, and two of its three
  // members do not survive object spread.
  const headers = new Headers(options.headers);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");

  const init: RequestInit = { headers };
  if (options.signal) init.signal = options.signal;

  const res = await impl(url, init);

  if (!res.ok) {
    throw new Error(`Failed to load content from ${url} (${res.status})`);
  }

  const body: unknown = await res.json();

  // A misrouted URL usually still returns 200, with HTML or some other shape.
  // Failing here beats an engine that silently starts with nothing.
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new Error(
      `Content at ${url} is not an ItemMap: expected a JSON object keyed by collection.`,
    );
  }

  return body as ItemMap;
}
