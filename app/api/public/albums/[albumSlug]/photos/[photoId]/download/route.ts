import { getCloudflareContext } from "@opennextjs/cloudflare";

import {
  adminSettingsSchema,
  type PublicDownloadPolicy
} from "@/admin/archive-schema";
import { defaultAdminSettings } from "@/admin/default-settings";
import { apiError } from "@/server/cloudflare/api-response";

export const dynamic = "force-dynamic";

type DownloadRow = {
  album_policy: PublicDownloadPolicy;
  asset_id: string | null;
  bucket: string | null;
  mime_type: string | null;
  object_key: string | null;
  photo_override: PublicDownloadPolicy | null;
  photo_title: string;
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ albumSlug: string; photoId: string }> }
) {
  const { env } = getCloudflareContext();
  const { albumSlug, photoId } = await context.params;
  const settings = await readSettings(env.DB);
  const row = await env.DB.prepare(`
    SELECT
      a.public_download_policy AS album_policy,
      p.public_download_override AS photo_override,
      p.title AS photo_title,
      aa.id AS asset_id,
      aa.bucket,
      aa.object_key,
      aa.mime_type
    FROM archive_albums a
    JOIN album_photos ap ON ap.album_id = a.id
    JOIN archive_photos p ON p.id = ap.photo_id
    LEFT JOIN archive_assets aa ON aa.id = (
      SELECT candidate.id
      FROM archive_assets candidate
      WHERE candidate.photo_id = p.id
        AND candidate.access = 'public'
        AND candidate.version IN ('expanded', 'downloadJpeg')
      ORDER BY CASE candidate.version WHEN 'expanded' THEN 0 ELSE 1 END
      LIMIT 1
    )
    WHERE a.slug = ?
      AND a.status = 'published'
      AND p.id = ?
      AND p.status = 'published'
  `).bind(albumSlug, photoId).first<DownloadRow>();

  if (!row) return apiError("download_not_found", "The photo is not available.", 404);
  const policy = resolvePolicy(
    row.photo_override ?? "inherit",
    resolvePolicy(row.album_policy, settings.publicDownloadMode)
  );
  if (policy === "none" || policy === "inherit") {
    return apiError("download_disabled", "Downloading is disabled for this album.", 404);
  }
  if (!row.asset_id || !row.object_key || row.bucket !== "yakov-public-assets") {
    return apiError("download_unavailable", "The expanded JPEG is not available.", 404);
  }

  const object = await env.PUBLIC_ASSETS.get(row.object_key);
  if (!object) return apiError("download_missing", "The stored JPEG could not be found.", 404);

  const headers = new Headers();
  headers.set("content-type", row.mime_type ?? "image/jpeg");
  headers.set("content-length", String(object.size));
  headers.set("content-disposition", `attachment; filename="${downloadFileName(row.photo_title, photoId)}"`);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  headers.set("etag", object.httpEtag);
  headers.set("x-content-type-options", "nosniff");
  return new Response(object.body, { headers });
}

async function readSettings(db: CloudflareEnv["DB"]) {
  const row = await db.prepare("SELECT value FROM admin_settings WHERE key = 'archive'")
    .first<{ value: string }>();
  if (!row) return defaultAdminSettings;
  try {
    return adminSettingsSchema.parse(JSON.parse(row.value));
  } catch {
    return defaultAdminSettings;
  }
}

function resolvePolicy(policy: PublicDownloadPolicy, fallback: PublicDownloadPolicy) {
  return policy === "inherit" ? fallback : policy;
}

function downloadFileName(title: string, fallback: string) {
  const stem = title
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/(^-+|-+$)/g, "")
    .slice(0, 120);
  return `${stem || fallback}.jpg`;
}
