import type { ApiErrorPayload } from "../shared/contracts";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string
  ) {
    super(message);
  }
}

const securityHeaders: Record<string, string> = {
  "Content-Security-Policy": "default-src 'self'; img-src 'self' https://assets.yakov.shmol.cc data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY"
};

export function json<T = unknown>(
  value: T,
  init: ResponseInit = {},
  cacheControl = "no-store"
): Response {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", cacheControl);
  for (const [key, headerValue] of Object.entries(securityHeaders)) {
    headers.set(key, headerValue);
  }
  return new Response(JSON.stringify(value), { ...init, headers });
}

export function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) {
    return json<ApiErrorPayload>(
      { error: { code: error.code, message: error.message } },
      { status: error.status }
    );
  }
  console.error("LogJam request failed", error instanceof Error ? error.message : "unknown error");
  return json<ApiErrorPayload>(
    { error: { code: "internal_error", message: "The request could not be completed." } },
    { status: 500 }
  );
}

export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  const maxBodyBytes = 64 * 1024;
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > maxBodyBytes) {
    throw new HttpError(413, "body_too_large", "Request body is too large.");
  }

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  const reader = request.body?.getReader();
  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBodyBytes) {
        try {
          await reader.cancel();
        } catch {
          // The size rejection remains authoritative even if cancellation fails.
        }
        throw new HttpError(413, "body_too_large", "Request body is too large.");
      }
      chunks.push(value);
    }
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const text = new TextDecoder().decode(bytes);
  try {
    const value = JSON.parse(text) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return value as Record<string, unknown>;
  } catch {
    throw new HttpError(400, "invalid_json", "A JSON object is required.");
  }
}

export function methodNotAllowed(allowed: string[]): never {
  throw new HttpError(405, "method_not_allowed", `Use ${allowed.join(" or ")} for this endpoint.`);
}
