import { ZodError } from "zod";

export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>,
    public retryAfter?: number,
  ) {
    super(message);
  }
}

export const jsonOk = (data: unknown, status = 200) => Response.json({ ok: true, data }, { status });

export function zodFields(err: ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of err.issues) {
    const path = issue.path.join(".") || "_";
    if (!fields[path]) fields[path] = issue.message;
  }
  return fields;
}

export function errorResponse(err: unknown): Response {
  if (err instanceof AppError) {
    const headers: Record<string, string> = {};
    if (err.retryAfter) headers["Retry-After"] = String(err.retryAfter);
    return Response.json(
      { ok: false, error: { code: err.code, message: err.message, fields: err.fields } },
      { status: err.status, headers },
    );
  }
  if (err instanceof ZodError) {
    return Response.json(
      { ok: false, error: { code: "VALIDATION_ERROR", message: "Please check the highlighted fields.", fields: zodFields(err) } },
      { status: 400 },
    );
  }
  console.error("unhandled error", err);
  return Response.json({ ok: false, error: { code: "INTERNAL", message: "Something went wrong. Please try again." } }, { status: 500 });
}

/** Wraps a route handler so thrown errors become the documented JSON error shape. */
export function handle<A extends unknown[]>(fn: (req: Request, ...rest: A) => Promise<Response>) {
  return async (req: Request, ...rest: A): Promise<Response> => {
    try {
      return await fn(req, ...rest);
    } catch (err) {
      return errorResponse(err);
    }
  };
}

export function clientIp(req: Request): string {
  return req.headers.get("cf-connecting-ip") ?? req.headers.get("x-real-ip") ?? "local";
}

/** State-changing requests must come from our own pages. */
export function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  let ok = false;
  try {
    ok = !!origin && !!host && new URL(origin).host === host;
  } catch {
    ok = false;
  }
  if (!ok) throw new AppError(403, "BAD_ORIGIN", "This request was not sent from the hackathon website.");
}

export async function readJson(req: Request, maxBytes = 64 * 1024): Promise<unknown> {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > maxBytes) throw new AppError(413, "BODY_TOO_LARGE", "The request is too large.");
  const text = await req.text();
  if (new TextEncoder().encode(text).length > maxBytes) throw new AppError(413, "BODY_TOO_LARGE", "The request is too large.");
  try {
    return JSON.parse(text);
  } catch {
    throw new AppError(400, "VALIDATION_ERROR", "The request body is not valid JSON.");
  }
}
