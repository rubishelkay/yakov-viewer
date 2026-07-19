import "server-only";

type AdminAccessEnv = Pick<CloudflareEnv, "ADMIN_ACCESS_ENABLED" | "ADMIN_EMAIL"> & {
  ADMIN_LOCAL_BYPASS?: string;
};

export function isAdminAccessEnabled(value: string | undefined) {
  return value === "true";
}

export function requireAdminAccess(request: Request, env: AdminAccessEnv) {
  if (isAdminLocalBypassEnabled(env.ADMIN_LOCAL_BYPASS)) {
    return null;
  }

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

export function isAdminLocalBypassEnabled(value: string | undefined) {
  return value === "true";
}
