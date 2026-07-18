import "server-only";

export function apiData<T>(data: T, init: ResponseInit = {}) {
  return Response.json(
    { ok: true, data },
    {
      ...init,
      headers: {
        "cache-control": "no-store",
        ...init.headers
      }
    }
  );
}

export function apiError(code: string, message: string, status: number, details?: unknown) {
  return Response.json(
    {
      ok: false,
      error: {
        code,
        message,
        ...(details === undefined ? {} : { details })
      }
    },
    {
      status,
      headers: { "cache-control": "no-store" }
    }
  );
}
