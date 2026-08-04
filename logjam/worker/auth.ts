import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

import { safeReturnTo } from "../shared/logic";
import type { AccessIdentity, AppUser, Env } from "./env";
import { HttpError } from "./http";

const jwksByUrl = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

type AppUserRow = {
  id: string;
  access_sub: string;
  email_normalized: string;
  owner_display_name: string | null;
  last_seen_at: string | null;
};

const LAST_SEEN_WRITE_INTERVAL_MS = 10 * 60 * 1000;

export async function requireAccessIdentity(request: Request, env: Env): Promise<AccessIdentity> {
  if (isExactLocalBypass(env)) {
    return {
      sub: requiredLocalValue(env.LOCAL_AUTH_USER_ID, "LOCAL_AUTH_USER_ID"),
      email: normalizeEmail(requiredLocalValue(env.LOCAL_AUTH_EMAIL, "LOCAL_AUTH_EMAIL")),
      displayName: env.LOCAL_AUTH_NAME?.trim() || "Local curator"
    };
  }

  if (env.ACCESS_ENABLED !== "true") {
    throw new HttpError(503, "auth_misconfigured", "Authentication is not configured.");
  }

  const teamDomain = validateTeamDomain(env.ACCESS_TEAM_DOMAIN);
  const audiences = (env.ACCESS_APP_AUD ?? "").split(",").map((value) => value.trim()).filter(Boolean);
  if (audiences.length === 0 || audiences.some((value) => value.startsWith("REPLACE_"))) {
    throw new HttpError(503, "auth_misconfigured", "Authentication is not configured.");
  }
  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token) throw new HttpError(401, "authentication_required", "Sign in to continue.");

  try {
    const certsUrl = `${teamDomain}/cdn-cgi/access/certs`;
    let jwks = jwksByUrl.get(certsUrl);
    if (!jwks) {
      jwks = createRemoteJWKSet(new URL(certsUrl));
      jwksByUrl.set(certsUrl, jwks);
    }
    const { payload } = await jwtVerify(token, jwks, {
      issuer: teamDomain,
      audience: audiences.length === 1 ? audiences[0] : audiences
    });
    return identityFromClaims(payload);
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(401, "invalid_access_token", "Your sign-in session is invalid or expired.");
  }
}

export async function ensureAppUser(db: D1Database, identity: AccessIdentity): Promise<AppUser> {
  const existing = await readIdentityUser(db, identity);
  if (existing) return syncIdentityUser(db, existing, identity);

  const now = new Date().toISOString();
  const id = `usr_${crypto.randomUUID()}`;
  try {
    await db.prepare(`
      INSERT INTO logjam_users (
        id, access_sub, email_normalized, owner_display_name, created_at, updated_at, last_seen_at
      ) VALUES (?, ?, ?, NULL, ?, ?, ?)
    `).bind(id, identity.sub, identity.email, now, now, now).run();
  } catch (error) {
    const raced = await readIdentityUser(db, identity);
    if (!raced) throw error;
    return syncIdentityUser(db, raced, identity);
  }
  return { id, email: identity.email, displayName: identity.displayName };
}

async function readIdentityUser(
  db: D1Database,
  identity: AccessIdentity
): Promise<AppUserRow | null> {
  const result = await db.prepare(`
    SELECT id, access_sub, email_normalized, owner_display_name, last_seen_at
    FROM logjam_users
    WHERE access_sub = ? OR email_normalized = ?
    ORDER BY id
  `).bind(identity.sub, identity.email).all<AppUserRow>();
  const matches = (result.results ?? []) as AppUserRow[];
  if (matches.length > 1) {
    throw new HttpError(
      409,
      "identity_conflict",
      "This verified identity conflicts with another LogJam account. Ask the owner for help."
    );
  }
  return matches[0] ?? null;
}

async function syncIdentityUser(
  db: D1Database,
  existing: AppUserRow,
  identity: AccessIdentity
): Promise<AppUser> {
  const nowMs = Date.now();
  const lastSeenMs = existing.last_seen_at ? Date.parse(existing.last_seen_at) : Number.NaN;
  const identityChanged = existing.access_sub !== identity.sub
    || existing.email_normalized !== identity.email;
  const shouldTouchLastSeen = !Number.isFinite(lastSeenMs)
    || nowMs - lastSeenMs >= LAST_SEEN_WRITE_INTERVAL_MS;
  if (!identityChanged && !shouldTouchLastSeen) {
    return {
      id: existing.id,
      email: identity.email,
      displayName: existing.owner_display_name?.trim() || identity.displayName
    };
  }

  const now = new Date(nowMs).toISOString();
  let resolved = existing;
  try {
    await db.prepare(`
      UPDATE logjam_users
      SET access_sub = ?, email_normalized = ?, updated_at = ?, last_seen_at = ?
      WHERE id = ?
    `).bind(identity.sub, identity.email, now, now, existing.id).run();
  } catch (error) {
    const raced = await readIdentityUser(db, identity);
    if (
      !raced ||
      raced.access_sub !== identity.sub ||
      raced.email_normalized !== identity.email
    ) {
      throw error;
    }
    resolved = raced;
  }
  return {
    id: resolved.id,
    email: identity.email,
    displayName: resolved.owner_display_name?.trim() || identity.displayName
  };
}

export function authStartResponse(url: URL): Response {
  const returnTo = safeReturnTo(url.searchParams.get("returnTo"));
  return new Response(null, {
    status: 303,
    headers: {
      "Cache-Control": "no-store",
      Location: returnTo,
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

function isExactLocalBypass(env: Env): boolean {
  if (env.RUNTIME_ENV === "production" && env.LOCAL_AUTH_BYPASS === "true") {
    throw new HttpError(503, "auth_misconfigured", "Local authentication bypass is forbidden in production.");
  }
  return env.RUNTIME_ENV === "local"
    && env.ACCESS_ENABLED === "false"
    && env.LOCAL_AUTH_BYPASS === "true";
}

function requiredLocalValue(value: string | undefined, key: string): string {
  const normalized = value?.trim();
  if (!normalized) throw new HttpError(503, "auth_misconfigured", `${key} is required for local auth.`);
  return normalized;
}

function validateTeamDomain(raw: string | undefined): string {
  try {
    const value = raw?.trim() ?? "";
    if (!value || value.includes("REPLACE")) throw new Error();
    const url = new URL(value);
    if (url.protocol !== "https:" || !url.hostname.endsWith(".cloudflareaccess.com")) throw new Error();
    return url.origin;
  } catch {
    throw new HttpError(503, "auth_misconfigured", "Cloudflare Access team domain is invalid.");
  }
}

function identityFromClaims(payload: JWTPayload): AccessIdentity {
  const emailClaim = payload.email;
  if (typeof payload.sub !== "string" || !payload.sub || typeof emailClaim !== "string") {
    throw new HttpError(401, "invalid_access_token", "The Access token has no verified identity.");
  }
  const email = normalizeEmail(emailClaim);
  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  return {
    sub: payload.sub,
    email,
    displayName: name || email.split("@")[0] || "Curator"
  };
}

function normalizeEmail(value: string): string {
  const email = value.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 254) {
    throw new HttpError(401, "invalid_access_token", "The Access token email is invalid.");
  }
  return email;
}
