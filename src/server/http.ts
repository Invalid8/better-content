import { UnauthorizedError } from "./createAdminGate";

export type ErrorReporter = (error: unknown) => void;

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export class BadRequestError extends Error {}

export async function readObjectBody(
  req: Request,
): Promise<Record<string, unknown>> {
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

export const defaultOnError: ErrorReporter = (error) => {
  console.error("[better-content]", error);
};

export function errorResponse(
  error: unknown,
  onError: ErrorReporter,
): Response {
  if (error instanceof UnauthorizedError) {
    if (error.status === 401) {
      return json({ error: error.message, logout: true }, 401);
    }
    return json({ error: error.message }, 403);
  }
  if (error instanceof BadRequestError) {
    return json({ error: error.message }, 400);
  }

  // Adapter errors can carry query text and values, so they stay server-side.
  onError(error);
  return json({ error: "Request failed" }, 500);
}
