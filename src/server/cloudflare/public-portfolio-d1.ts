import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { cache } from "react";

import { adminSettingsSchema, type PublicDownloadPolicy } from "@/admin/archive-schema";
import { defaultAdminSettings } from "@/admin/default-settings";
import type {
  PublicAlbumDetail,
  PublicAlbumSummary,
  PublicPhoto,
  PublicTag
} from "@/lib/portfolio";

type Database = CloudflareEnv["DB"];
type AlbumRow = {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  public_download_policy: PublicDownloadPolicy;
  photo_order_direction: "forward" | "reverse";
  cover_url: string | null;
  photo_count: number;
};
type PhotoRow = {
  id: string;
  slug: string;
  title: string;
  width: number;
  height: number;
  position: number;
  public_download_override: PublicDownloadPolicy | null;
  thumb_url: string | null;
  display_url: string | null;
  expanded_url: string | null;
  download_url: string | null;
};
type TagRow = { album_id: string; label: string; slug: string };

export const readPublicAlbums = cache(async (): Promise<PublicAlbumSummary[]> => {
  const { env } = await getCloudflareContext({ async: true });
  const [albumResult, albumTagResult, filterTagResult] = await env.DB.batch([
    env.DB.prepare(`
      SELECT
        a.id,
        a.slug,
        a.title,
        a.subtitle,
        a.public_download_policy,
        a.photo_order_direction,
        COALESCE(
          CASE
            WHEN cover.access = 'public' AND cover_photo.status = 'published'
            THEN cover.public_url
          END,
          (
            SELECT COALESCE(
              MAX(CASE WHEN fallback_asset.version = 'display' THEN fallback_asset.public_url END),
              MAX(CASE WHEN fallback_asset.version = 'thumb' THEN fallback_asset.public_url END)
            )
            FROM album_photos fallback_ap
            JOIN archive_photos fallback_photo ON fallback_photo.id = fallback_ap.photo_id
            JOIN archive_assets fallback_asset ON fallback_asset.photo_id = fallback_photo.id
            WHERE fallback_ap.album_id = a.id
              AND fallback_photo.status = 'published'
              AND fallback_asset.access = 'public'
              AND fallback_asset.version IN ('display', 'thumb')
            GROUP BY fallback_ap.photo_id, fallback_ap.position
            ORDER BY fallback_ap.position
            LIMIT 1
          )
        ) AS cover_url,
        COUNT(DISTINCT CASE WHEN p.status = 'published' THEN p.id END) AS photo_count
      FROM archive_albums a
      LEFT JOIN archive_assets cover ON cover.id = CASE a.cover_priority
        WHEN 'portrait' THEN COALESCE(a.cover_portrait_asset_id, a.cover_landscape_asset_id, a.cover_square_asset_id)
        WHEN 'square' THEN COALESCE(a.cover_square_asset_id, a.cover_landscape_asset_id, a.cover_portrait_asset_id)
        ELSE COALESCE(a.cover_landscape_asset_id, a.cover_square_asset_id, a.cover_portrait_asset_id)
      END
      LEFT JOIN archive_photos cover_photo ON cover_photo.id = cover.photo_id
      LEFT JOIN album_photos ap ON ap.album_id = a.id
      LEFT JOIN archive_photos p ON p.id = ap.photo_id
      WHERE a.status = 'published'
      GROUP BY a.id
      ORDER BY a.sort_order, a.created_at
    `),
    env.DB.prepare(`
      SELECT at.album_id, t.label, t.slug
      FROM album_tags at
      JOIN archive_tags t ON t.id = at.tag_id
      JOIN archive_albums a ON a.id = at.album_id
      WHERE a.status = 'published'
      ORDER BY t.label COLLATE NOCASE
    `),
    env.DB.prepare(`
      SELECT DISTINCT album_id, label, slug
      FROM (
        SELECT at.album_id, t.label, t.slug
        FROM album_tags at
        JOIN archive_tags t ON t.id = at.tag_id
        JOIN archive_albums a ON a.id = at.album_id
        WHERE a.status = 'published'

        UNION

        SELECT ap.album_id, t.label, t.slug
        FROM photo_tags pt
        JOIN archive_tags t ON t.id = pt.tag_id
        JOIN archive_photos p ON p.id = pt.photo_id
        JOIN album_photos ap ON ap.photo_id = p.id
        JOIN archive_albums a ON a.id = ap.album_id
        WHERE a.status = 'published' AND p.status = 'published'
      )
      ORDER BY label COLLATE NOCASE
    `)
  ]);
  const albumTagsByAlbum = groupTags(rows<TagRow>(albumTagResult));
  const filterTagsByAlbum = groupTags(rows<TagRow>(filterTagResult));
  return rows<AlbumRow>(albumResult).map((album) => mapAlbumSummary(
    album,
    albumTagsByAlbum.get(album.id) ?? [],
    filterTagsByAlbum.get(album.id) ?? []
  ));
});

export const readPublicHomepageAlbums = cache(async (): Promise<PublicAlbumSummary[]> => {
  const { env } = await getCloudflareContext({ async: true });
  const albums: PublicAlbumSummary[] = await readPublicAlbums();
  const membershipResult = await env.DB.prepare(`
    SELECT sa.album_id
    FROM archive_sets s
    JOIN set_albums sa ON sa.set_id = s.id
    JOIN archive_albums a ON a.id = sa.album_id
    WHERE s.status = 'published' AND a.status = 'published'
    ORDER BY s.sort_order, sa.position, a.sort_order, a.created_at
  `).all<{ album_id: string }>();
  const albumById = new Map(albums.map((album) => [album.id, album]));
  const seen = new Set<string>();

  return rows<{ album_id: string }>(membershipResult).flatMap(({ album_id }) => {
    if (seen.has(album_id)) return [];
    seen.add(album_id);
    const album = albumById.get(album_id);
    return album ? [album] : [];
  });
});

export const readPublicAlbumBySlug = cache(async (slug: string): Promise<PublicAlbumDetail | undefined> => {
  const { env } = await getCloudflareContext({ async: true });
  const album = await env.DB.prepare(`
    SELECT
      a.id,
      a.slug,
      a.title,
      a.subtitle,
      a.public_download_policy,
      a.photo_order_direction,
      COALESCE(
        CASE
          WHEN cover.access = 'public' AND cover_photo.status = 'published'
          THEN cover.public_url
        END,
        (
          SELECT COALESCE(
            MAX(CASE WHEN fallback_asset.version = 'display' THEN fallback_asset.public_url END),
            MAX(CASE WHEN fallback_asset.version = 'thumb' THEN fallback_asset.public_url END)
          )
          FROM album_photos fallback_ap
          JOIN archive_photos fallback_photo ON fallback_photo.id = fallback_ap.photo_id
          JOIN archive_assets fallback_asset ON fallback_asset.photo_id = fallback_photo.id
          WHERE fallback_ap.album_id = a.id
            AND fallback_photo.status = 'published'
            AND fallback_asset.access = 'public'
            AND fallback_asset.version IN ('display', 'thumb')
          GROUP BY fallback_ap.photo_id, fallback_ap.position
          ORDER BY fallback_ap.position
          LIMIT 1
        )
      ) AS cover_url,
      (
        SELECT COUNT(*)
        FROM album_photos count_ap
        JOIN archive_photos count_p ON count_p.id = count_ap.photo_id
        WHERE count_ap.album_id = a.id AND count_p.status = 'published'
      ) AS photo_count
    FROM archive_albums a
    LEFT JOIN archive_assets cover ON cover.id = CASE a.cover_priority
      WHEN 'portrait' THEN COALESCE(a.cover_portrait_asset_id, a.cover_landscape_asset_id, a.cover_square_asset_id)
      WHEN 'square' THEN COALESCE(a.cover_square_asset_id, a.cover_landscape_asset_id, a.cover_portrait_asset_id)
      ELSE COALESCE(a.cover_landscape_asset_id, a.cover_square_asset_id, a.cover_portrait_asset_id)
    END
    LEFT JOIN archive_photos cover_photo ON cover_photo.id = cover.photo_id
    WHERE a.slug = ? AND a.status = 'published'
  `).bind(slug).first<AlbumRow>();
  if (!album) return undefined;

  const [photoResult, tagResult, settings] = await Promise.all([
    env.DB.prepare(`
      SELECT
        p.id,
        p.slug,
        p.title,
        p.width,
        p.height,
        ap.position,
        p.public_download_override,
        MAX(CASE WHEN aa.version = 'thumb' AND aa.access = 'public' THEN aa.public_url END) AS thumb_url,
        MAX(CASE WHEN aa.version = 'display' AND aa.access = 'public' THEN aa.public_url END) AS display_url,
        MAX(CASE WHEN aa.version = 'expanded' AND aa.access = 'public' THEN aa.public_url END) AS expanded_url,
        MAX(CASE WHEN aa.version = 'downloadJpeg' AND aa.access = 'public' THEN aa.public_url END) AS download_url
      FROM album_photos ap
      JOIN archive_photos p ON p.id = ap.photo_id
      LEFT JOIN archive_assets aa ON aa.photo_id = p.id
      WHERE ap.album_id = ? AND p.status = 'published'
      GROUP BY p.id, ap.position
      ORDER BY ap.position
    `).bind(album.id).all<PhotoRow>(),
    env.DB.prepare(`
      SELECT at.album_id, t.label, t.slug
      FROM album_tags at
      JOIN archive_tags t ON t.id = at.tag_id
      WHERE at.album_id = ?
      ORDER BY t.label COLLATE NOCASE
    `).bind(album.id).all<TagRow>(),
    readPublicSettings(env.DB)
  ]);
  const orderedRows = rows<PhotoRow>(photoResult);
  if (album.photo_order_direction === "reverse") orderedRows.reverse();
  const albumPolicy = resolvePolicy(album.public_download_policy, settings.publicDownloadMode);
  const photos = orderedRows.flatMap<PublicPhoto>((photo) => {
    if (!photo.thumb_url || !photo.display_url) return [];
    const expandedUrl = photo.expanded_url ?? photo.display_url;
    const photoPolicy = resolvePolicy(photo.public_download_override ?? "inherit", albumPolicy);
    const downloadUrl = photoPolicy === "none"
      ? undefined
      : photo.download_url || photo.expanded_url
        ? `/api/public/albums/${encodeURIComponent(album.slug)}/photos/${encodeURIComponent(photo.id)}/download/`
        : undefined;

    return [{
      id: photo.id,
      title: photo.title,
      width: photo.width,
      height: photo.height,
      thumbUrl: photo.thumb_url,
      displayUrl: photo.display_url,
      expandedUrl,
      downloadUrl
    }];
  });

  return {
    ...mapAlbumSummary(album, rows<TagRow>(tagResult), rows<TagRow>(tagResult)),
    photoCount: photos.length,
    photos
  };
});

export const readPublicTags = cache(async (): Promise<PublicTag[]> => {
  const albums = await readPublicAlbums();
  const bySlug = new Map<string, string>();
  for (const album of albums) {
    for (const tag of album.filterTags) {
      bySlug.set(tag.slug, tag.label);
    }
  }
  return Array.from(bySlug, ([slug, label]) => ({ slug, label }));
});

export async function readPublicTagBySlug(slug: string) {
  return (await readPublicTags()).find((tag) => tag.slug === slug);
}

export async function readPublicAlbumsForTag(slug: string) {
  return (await readPublicAlbums()).filter((album) => album.tagSlugs.includes(slug));
}

function mapAlbumSummary(
  album: AlbumRow,
  albumTags: TagRow[],
  filterTags: TagRow[]
): PublicAlbumSummary {
  const tagSlugs = filterTags.map((tag) => tag.slug);
  const kind = tagSlugs.includes("film") ? "film" : "digital";
  return {
    coverUrl: album.cover_url ?? "",
    filterTags: filterTags.map((tag) => ({ label: tag.label, slug: tag.slug })),
    id: album.id,
    kind,
    photoCount: Number(album.photo_count),
    slug: album.slug,
    subtitle: album.subtitle,
    subtitleTags: albumTags.map((tag) => ({ label: tag.label, slug: tag.slug })),
    tagSlugs,
    title: album.title
  };
}

async function readPublicSettings(db: Database) {
  const row = await db.prepare("SELECT value FROM admin_settings WHERE key = 'archive'")
    .first<{ value: string }>();
  if (!row) return defaultAdminSettings;
  try {
    return adminSettingsSchema.parse(JSON.parse(row.value));
  } catch {
    return defaultAdminSettings;
  }
}

function resolvePolicy(
  policy: PublicDownloadPolicy,
  fallback: PublicDownloadPolicy
): PublicDownloadPolicy {
  return policy === "inherit" ? fallback === "inherit" ? "none" : fallback : policy;
}

function rows<T>(result: { results?: unknown[] }): T[] {
  return (result.results ?? []) as T[];
}

function groupTags(tags: TagRow[]) {
  const result = new Map<string, TagRow[]>();
  for (const tag of tags) result.set(tag.album_id, [...(result.get(tag.album_id) ?? []), tag]);
  return result;
}
