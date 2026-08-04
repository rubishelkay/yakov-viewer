import type { ApiErrorPayload } from "../../shared/contracts";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly authenticationRequired = false
  ) {
    super(message);
  }
}

export async function publicApi<T>(path: string, signal?: AbortSignal): Promise<T> {
  return requestJson<T>(path, { method: "GET", signal }, false);
}

export async function privateApi<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const method = init.method?.toUpperCase() ?? "GET";
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (method !== "GET" && method !== "HEAD") {
    headers.set("Content-Type", "application/json");
  }
  return requestJson<T>(path, {
    ...init,
    headers,
    credentials: "same-origin",
    redirect: "manual"
  }, true);
}

export function jsonBody(value: unknown): string {
  return JSON.stringify(value);
}

async function requestJson<T>(
  path: string,
  init: RequestInit,
  privateRequest: boolean
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, init);
  } catch {
    throw new ApiError(
      0,
      "network_error",
      "Check your connection and try again.",
      false
    );
  }
  if (response.ok && response.status === 204) return undefined as T;
  const contentType = response.headers.get("content-type") ?? "";
  if (privateRequest && isAccessAuthenticationResponse(response)) {
    throw new ApiError(401, "authentication_required", "Sign in to continue.", true);
  }
  if (!contentType.includes("application/json")) {
    throw new ApiError(
      response.status,
      "unexpected_response",
      "The server returned an unexpected response. Try again.",
      false
    );
  }
  const payload = contentType.includes("application/json")
    ? await response.json() as T | ApiErrorPayload
    : undefined;
  if (!response.ok) {
    const error = payload && typeof payload === "object" && "error" in payload
      ? (payload as ApiErrorPayload).error
      : { code: "request_failed", message: "The request could not be completed." };
    throw new ApiError(
      response.status,
      error.code,
      error.message,
      response.status === 401 || error.code === "authentication_required"
    );
  }
  return payload as T;
}

export function isAccessAuthenticationResponse(
  response: Pick<Response, "status" | "redirected" | "type" | "url">
): boolean {
  if (response.type === "opaqueredirect") return true;
  if (response.status >= 300 && response.status < 400) return true;
  if (response.status === 401) return true;
  if (!response.redirected || !response.url) return false;
  try {
    const url = new URL(response.url);
    return url.pathname.startsWith("/cdn-cgi/access/")
      || url.hostname.endsWith(".cloudflareaccess.com");
  } catch {
    return false;
  }
}
