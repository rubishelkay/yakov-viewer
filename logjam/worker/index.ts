import { isDecision, normalizePhotoIds, normalizeTitle } from "../shared/logic";
import {
  authStartResponse,
  ensureAppUser,
  requireAccessIdentity,
  requireInvitation
} from "./auth";
import type { AppUser, Env } from "./env";
import { errorResponse, HttpError, json, methodNotAllowed, readJsonObject } from "./http";
import {
  archiveCuration,
  createCuration,
  listPublicAlbums,
  putDecision,
  readAccount,
  readCuration,
  readPublicAlbum,
  submitCuration,
  updateCuration
} from "./repository";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    try {
      if (url.pathname === "/auth/start" || url.pathname === "/auth/start/") {
        if (request.method !== "GET") methodNotAllowed(["GET"]);
        const identity = await requireAccessIdentity(request, env);
        await requireInvitation(env.DB, identity);
        await ensureAppUser(env.DB, identity);
        return authStartResponse(url);
      }

      if (url.pathname.startsWith("/api/public/")) {
        return await handlePublic(request, env, url);
      }

      if (url.pathname === "/api/private" || url.pathname.startsWith("/api/private/")) {
        enforcePrivateMutation(request);
        const identity = await requireAccessIdentity(request, env);
        await enforcePrivateRequestRate(request, env, url, identity.sub);
        await requireInvitation(env.DB, identity);
        const user = await ensureAppUser(env.DB, identity);
        return await handlePrivate(request, env, url, user);
      }

      if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
        throw new HttpError(404, "endpoint_not_found", "API endpoint not found.");
      }

      return env.ASSETS.fetch(request);
    } catch (error) {
      return errorResponse(error);
    }
  }
} satisfies ExportedHandler<Env>;

async function handlePublic(request: Request, env: Env, url: URL): Promise<Response> {
  if (request.method !== "GET") methodNotAllowed(["GET"]);
  const cache = "public, max-age=30, s-maxage=300, stale-while-revalidate=600";
  if (url.pathname === "/api/public/albums" || url.pathname === "/api/public/albums/") {
    return json({ albums: await listPublicAlbums(env.DB) }, {}, cache);
  }
  const match = url.pathname.match(/^\/api\/public\/albums\/([^/]+)\/?$/);
  if (match) {
    return json({ album: await readPublicAlbum(env.DB, decodeSegment(match[1])) }, {}, cache);
  }
  throw new HttpError(404, "endpoint_not_found", "Public endpoint not found.");
}

async function handlePrivate(
  request: Request,
  env: Env,
  url: URL,
  user: AppUser
): Promise<Response> {
  if (url.pathname === "/api/private/session" || url.pathname === "/api/private/session/") {
    if (request.method !== "GET") methodNotAllowed(["GET"]);
    return json({
      viewer: { id: user.id, email: user.email, displayName: user.displayName }
    });
  }

  if (url.pathname === "/api/private/account" || url.pathname === "/api/private/account/") {
    if (request.method !== "GET") methodNotAllowed(["GET"]);
    return json(await readAccount(env.DB, user));
  }

  const decisionMatch = url.pathname.match(/^\/api\/private\/decisions\/([^/]+)\/?$/);
  if (decisionMatch) {
    if (request.method !== "PUT") methodNotAllowed(["PUT"]);
    const body = await readJsonObject(request);
    if (!isDecision(body.decision)) throw new HttpError(400, "invalid_decision", "Decision must be keep or pass.");
    const photoId = decodeSegment(decisionMatch[1]);
    return json({ decision: await putDecision(env.DB, user.id, photoId, body.decision) });
  }

  if (url.pathname === "/api/private/curations" || url.pathname === "/api/private/curations/") {
    if (request.method !== "POST") methodNotAllowed(["POST"]);
    const body = await readJsonObject(request);
    const title = normalizeTitle(body.title);
    if (!title) throw new HttpError(400, "invalid_title", "Curation title must be 1–160 characters.");
    return json({ curation: await createCuration(env.DB, user.id, title) }, { status: 201 });
  }

  const submitMatch = url.pathname.match(/^\/api\/private\/curations\/([^/]+)\/submit\/?$/);
  if (submitMatch) {
    if (request.method !== "POST") methodNotAllowed(["POST"]);
    await readJsonObject(request);
    const submission = await submitCuration(env.DB, user.id, decodeSegment(submitMatch[1]));
    return json({ submission }, { status: 201 });
  }

  const curationMatch = url.pathname.match(/^\/api\/private\/curations\/([^/]+)\/?$/);
  if (curationMatch) {
    const curationId = decodeSegment(curationMatch[1]);
    if (request.method === "GET") {
      return json({ curation: await readCuration(env.DB, user.id, curationId) });
    }
    if (request.method === "PATCH") {
      const body = await readJsonObject(request);
      const hasTitle = Object.prototype.hasOwnProperty.call(body, "title");
      const hasPhotoIds = Object.prototype.hasOwnProperty.call(body, "photoIds");
      if (!hasTitle && !hasPhotoIds) throw new HttpError(400, "empty_update", "Provide a title or ordered photoIds.");
      const title = hasTitle ? normalizeTitle(body.title) : undefined;
      const photoIds = hasPhotoIds ? normalizePhotoIds(body.photoIds) : undefined;
      if (hasTitle && !title) throw new HttpError(400, "invalid_title", "Curation title must be 1–160 characters.");
      if (hasPhotoIds && !photoIds) throw new HttpError(400, "invalid_photo_ids", "photoIds must be a unique list of at most 500 IDs.");
      return json({
        curation: await updateCuration(env.DB, user.id, curationId, {
          title: title ?? undefined,
          photoIds: photoIds ?? undefined
        })
      });
    }
    if (request.method === "DELETE") {
      await readJsonObject(request);
      await archiveCuration(env.DB, user.id, curationId);
      return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
    }
    methodNotAllowed(["GET", "PATCH", "DELETE"]);
  }

  throw new HttpError(404, "endpoint_not_found", "Private endpoint not found.");
}

export function enforcePrivateMutation(request: Request): void {
  if (request.method === "GET" || request.method === "HEAD") return;
  const requestUrl = new URL(request.url);
  if (request.headers.get("Origin") !== requestUrl.origin) {
    throw new HttpError(403, "csrf_rejected", "Cross-origin mutations are not allowed.");
  }
  const contentType = request.headers.get("Content-Type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") {
    throw new HttpError(415, "json_required", "Mutations require application/json.");
  }
}

export async function enforcePrivateMutationRate(env: Env, userId: string) {
  const rate = await env.PRIVATE_MUTATION_RATE_LIMITER.limit({
    key: `${userId}:private-mutation`
  });
  if (!rate.success) {
    throw new HttpError(
      429,
      "private_mutation_rate_limited",
      "Too many changes. Pause for a moment and try again."
    );
  }
}

export async function enforcePrivateRequestRate(
  request: Request,
  env: Env,
  url: URL,
  verifiedIdentityKey: string
) {
  if (request.method === "GET" || request.method === "HEAD") return;
  if (
    request.method === "PUT" &&
    /^\/api\/private\/decisions\/[^/]+\/?$/.test(url.pathname)
  ) {
    const rate = await env.DECISION_RATE_LIMITER.limit({
      key: `${verifiedIdentityKey}:decision`
    });
    if (!rate.success) {
      throw new HttpError(
        429,
        "decision_rate_limited",
        "Too many decisions. Pause for a moment and try again."
      );
    }
    return;
  }
  await enforcePrivateMutationRate(env, verifiedIdentityKey);
}

function decodeSegment(value: string): string {
  try {
    const decoded = decodeURIComponent(value).trim();
    if (!decoded || decoded.length > 160 || decoded.includes("/")) throw new Error();
    return decoded;
  } catch {
    throw new HttpError(400, "invalid_path", "Invalid path identifier.");
  }
}
