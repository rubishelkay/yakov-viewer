import { getCloudflareContext } from "@opennextjs/cloudflare";

import { apiError } from "@/server/cloudflare/api-response";
import { requireAdminAccess } from "@/server/cloudflare/admin-auth";
import { findD1Asset } from "@/server/cloudflare/archive-d1";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ assetId: string }> }
) {
  const { env } = getCloudflareContext();
  const denied = requireAdminAccess(request, env);
  if (denied) return denied;

  const { assetId } = await context.params;
  const asset = await findD1Asset(env.DB, assetId);
  if (!asset) return apiError("asset_not_found", "Asset was not found.", 404);

  const bucket = asset.bucket === "yakov-public-assets"
    ? env.PUBLIC_ASSETS
    : asset.bucket === "yakov-private-assets"
      ? env.PRIVATE_ASSETS
      : undefined;
  if (!bucket) return apiError("asset_bucket_invalid", "Asset bucket is not configured.", 409);

  const object = await bucket.get(asset.object_key);
  if (!object) return apiError("asset_object_missing", "Stored asset object was not found.", 404);

  const headers = new Headers();
  applyHttpMetadata(headers, object.httpMetadata);
  headers.set("content-type", headers.get("content-type") ?? asset.mime_type);
  headers.set("content-length", String(object.size));
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", asset.access === "private" ? "private, no-store" : "public, max-age=31536000, immutable");
  headers.set("x-content-type-options", "nosniff");

  return new Response(object.body, { headers });
}

function applyHttpMetadata(
  headers: Headers,
  metadata?: {
    cacheControl?: string;
    cacheExpiry?: Date;
    contentDisposition?: string;
    contentEncoding?: string;
    contentLanguage?: string;
    contentType?: string;
  }
) {
  if (!metadata) return;
  if (metadata.contentType) headers.set("content-type", metadata.contentType);
  if (metadata.contentLanguage) headers.set("content-language", metadata.contentLanguage);
  if (metadata.contentDisposition) headers.set("content-disposition", metadata.contentDisposition);
  if (metadata.contentEncoding) headers.set("content-encoding", metadata.contentEncoding);
  if (metadata.cacheControl) headers.set("cache-control", metadata.cacheControl);
  if (metadata.cacheExpiry) headers.set("expires", metadata.cacheExpiry.toUTCString());
}
