import "server-only";

const localHosts = new Set(["127.0.0.1", "localhost", "::1"]);

export function isAdminAccessEnabled(value: string | undefined) {
  return value === "true";
}

export function requireAdminAccess(request: Request, env: CloudflareEnv) {
  const hostname = new URL(request.url).hostname;
  if (localHosts.has(hostname)) return null;

  if (!isAdminAccessEnabled(env.ADMIN_ACCESS_ENABLED)) {
    return Response.json(
      { ok: false, error: { code: "admin_disabled", message: "Admin access is not enabled." } },
      { status: 503 }
    );
  }

  const expectedEmail = env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!expectedEmail) {
    return Response.json(
      { ok: false, error: { code: "admin_access_unconfigured", message: "Admin access is not configured." } },
      { status: 503 }
    );
  }

  const authenticatedEmail = request.headers
    .get("Cf-Access-Authenticated-User-Email")
    ?.trim()
    .toLowerCase();

  if (authenticatedEmail !== expectedEmail) {
    return Response.json(
      { ok: false, error: { code: "unauthorized", message: "Cloudflare Access authentication is required." } },
      { status: 401 }
    );
  }

  return null;
}

export function isLocalAdminHost(host: string | null) {
  if (!host) return false;
  const hostname = host.startsWith("[")
    ? host.slice(1, host.indexOf("]"))
    : host.split(":")[0];
  return localHosts.has(hostname.toLowerCase());
}
