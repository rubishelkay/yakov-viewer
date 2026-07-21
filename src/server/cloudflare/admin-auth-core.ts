import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

const cloudflareAccessSuffix = ".cloudflareaccess.com";
const jwksByIssuer = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

export type AdminAccessEnv = {
  ACCESS_APP_AUD?: string;
  ACCESS_TEAM_DOMAIN?: string;
  ADMIN_ACCESS_ENABLED?: string;
  ADMIN_EMAIL?: string;
  ADMIN_LOCAL_BYPASS?: string;
  ADMIN_RUNTIME_ENV?: string;
};

export type AdminAccessResult =
  | { ok: true; email: string; payload?: JWTPayload; source: "access" | "local" }
  | { ok: false; code: string; message: string; status: number };

export async function verifyAdminAccess(
  headers: Headers,
  env: AdminAccessEnv
): Promise<AdminAccessResult> {
  const expectedEmail = env.ADMIN_EMAIL?.trim().toLowerCase();
  if (isAdminLocalBypass(headers, env)) {
    return expectedEmail
      ? { ok: true, email: expectedEmail, source: "local" }
      : denied("admin_access_unconfigured", "Admin access is not configured.", 503);
  }

  if (env.ADMIN_ACCESS_ENABLED !== "true") {
    return denied("admin_disabled", "Admin access is not enabled.", 503);
  }

  const issuer = normalizeTeamDomain(env.ACCESS_TEAM_DOMAIN);
  const audience = env.ACCESS_APP_AUD?.trim();
  if (!expectedEmail || !issuer || !audience) {
    return denied("admin_access_unconfigured", "Admin access is not configured.", 503);
  }

  const token = headers.get("cf-access-jwt-assertion")?.trim();
  if (!token) {
    return denied("unauthorized", "Cloudflare Access authentication is required.", 401);
  }

  try {
    const { payload } = await jwtVerify(token, getJwks(issuer), {
      algorithms: ["RS256"],
      audience,
      issuer
    });
    const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
    if (email !== expectedEmail) {
      return denied("forbidden", "This Cloudflare identity cannot access the admin.", 403);
    }

    return { ok: true, email, payload, source: "access" };
  } catch {
    return denied("unauthorized", "Cloudflare Access authentication is invalid.", 401);
  }
}

function getJwks(issuer: string) {
  let jwks = jwksByIssuer.get(issuer);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL("/cdn-cgi/access/certs", issuer));
    jwksByIssuer.set(issuer, jwks);
  }
  return jwks;
}

function normalizeTeamDomain(value: string | undefined) {
  if (!value?.trim()) return undefined;
  try {
    const url = new URL(value.trim().startsWith("https://") ? value.trim() : `https://${value.trim()}`);
    if (url.protocol !== "https:" || !url.hostname.endsWith(cloudflareAccessSuffix)) return undefined;
    if (url.username || url.password || (url.pathname !== "/" && url.pathname !== "")) return undefined;
    return url.origin;
  } catch {
    return undefined;
  }
}

function isAdminLocalBypass(_headers: Headers, env: AdminAccessEnv) {
  return env.ADMIN_ACCESS_ENABLED !== "true"
    && env.ADMIN_RUNTIME_ENV === "local"
    && env.ADMIN_LOCAL_BYPASS === "true";
}

function denied(code: string, message: string, status: number): AdminAccessResult {
  return { ok: false, code, message, status };
}
