import "server-only";

import {
  adminArchiveSchema,
  adminSettingsSchema,
  type AdminArchive,
  type ArchiveAlbum,
  type ArchiveAsset,
  type ArchivePhoto,
  type ArchiveStatus,
  type PublicDownloadPolicy
} from "@/admin/archive-schema";
import { defaultAdminSettings } from "@/admin/default-settings";

type Database = CloudflareEnv["DB"];
type RelationRow = { album_id: string; photo_id: string; position: number; created_at: string };
type SetAlbumRow = { set_id: string; album_id: string; position: number; featured: number };
type TagRefRow = { album_id?: string; photo_id?: string; tag_id: string };
type CollectionPhotoRow = { collection_id: string; photo_id: string; position: number };

type SetRow = {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  status: ArchiveStatus;
  sort_order: number;
  layout_mode: AdminArchive["sets"][number]["layoutMode"];
  created_at: string;
  updated_at: string;
  published_at: string | null;
  deleted_at: string | null;
};

type AlbumRow = {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  status: ArchiveStatus;
  is_demo: number;
  public_download_policy: PublicDownloadPolicy;
  cover_landscape_asset_id: string | null;
  cover_portrait_asset_id: string | null;
  cover_square_asset_id: string | null;
  sort_order: number;
  photo_order_direction: ArchiveAlbum["photoOrderDirection"] | null;
  date_start: string | null;
  date_end: string | null;
  location_text: string | null;
  camera: string | null;
  film_stock: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  deleted_at: string | null;
};

type PhotoRow = {
  id: string;
  slug: string;
  title: string;
  description: string;
  status: ArchiveStatus;
  frame_number: number | null;
  public_download_override: PublicDownloadPolicy | null;
  date_taken: string | null;
  location_text: string | null;
  width: number;
  height: number;
  dominant_color: string;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  hidden_at: string | null;
  deleted_at: string | null;
};

type AssetRow = {
  id: string;
  photo_id: string | null;
  album_id: string | null;
  version: ArchiveAsset["version"];
  access: ArchiveAsset["access"];
  bucket: string;
  object_key: string;
  public_url: string | null;
  width: number | null;
  height: number | null;
  bytes: number;
  mime_type: string;
  color_profile: ArchiveAsset["colorProfile"];
  created_at: string;
};

export async function readD1Archive(db: Database): Promise<AdminArchive> {
  const [
    setResult,
    albumResult,
    photoResult,
    albumPhotoResult,
    assetResult,
    tagResult,
    setAlbumResult,
    albumTagResult,
    photoTagResult,
    collectionResult,
    collectionPhotoResult,
    settingsResult,
    trashResult,
    uploadResult
  ] = await db.batch([
    db.prepare("SELECT * FROM archive_sets ORDER BY sort_order, created_at"),
    db.prepare("SELECT * FROM archive_albums ORDER BY sort_order, created_at"),
    db.prepare("SELECT * FROM archive_photos ORDER BY created_at"),
    db.prepare("SELECT * FROM album_photos ORDER BY album_id, position"),
    db.prepare("SELECT * FROM archive_assets ORDER BY created_at"),
    db.prepare("SELECT * FROM archive_tags ORDER BY label COLLATE NOCASE"),
    db.prepare("SELECT * FROM set_albums ORDER BY set_id, position"),
    db.prepare("SELECT album_id, tag_id FROM album_tags"),
    db.prepare("SELECT photo_id, tag_id FROM photo_tags"),
    db.prepare("SELECT * FROM archive_collections ORDER BY created_at"),
    db.prepare("SELECT * FROM collection_photos ORDER BY collection_id, position"),
    db.prepare("SELECT key, value FROM admin_settings"),
    db.prepare("SELECT * FROM trash_items ORDER BY deleted_at DESC"),
    db.prepare("SELECT * FROM upload_jobs ORDER BY created_at DESC")
  ]);

  const setRows = rows<SetRow>(setResult);
  const albumRows = rows<AlbumRow>(albumResult);
  const photoRows = rows<PhotoRow>(photoResult);
  const albumPhotoRows = rows<RelationRow>(albumPhotoResult);
  const assetRows = rows<AssetRow>(assetResult);
  const setAlbumRows = rows<SetAlbumRow>(setAlbumResult);
  const albumTagRows = rows<TagRefRow>(albumTagResult);
  const photoTagRows = rows<TagRefRow>(photoTagResult);
  const collectionPhotoRows = rows<CollectionPhotoRow>(collectionPhotoResult);
  const setRefs = groupBy(setAlbumRows, (row) => row.set_id);
  const albumTags = groupBy(albumTagRows, (row) => row.album_id ?? "");
  const photoTags = groupBy(photoTagRows, (row) => row.photo_id ?? "");
  const photoAssets = groupBy(assetRows.filter((row) => row.photo_id), (row) => row.photo_id ?? "");
  const collectionPhotos = groupBy(collectionPhotoRows, (row) => row.collection_id);
  const albumSetIds = new Map<string, string[]>();

  for (const row of setAlbumRows) {
    albumSetIds.set(row.album_id, [...(albumSetIds.get(row.album_id) ?? []), row.set_id]);
  }

  return adminArchiveSchema.parse({
    sets: setRows.map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      subtitle: row.subtitle,
      description: row.description,
      status: row.status,
      order: row.sort_order,
      layoutMode: row.layout_mode,
      albumIdsWithOrder: (setRefs.get(row.id) ?? []).map((reference) => ({
        albumId: reference.album_id,
        position: reference.position,
        featured: Boolean(reference.featured)
      })),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      publishedAt: optional(row.published_at),
      deletedAt: optional(row.deleted_at)
    })),
    albums: albumRows.map((row) => mapAlbum(row, albumSetIds, albumTags)),
    albumPhotos: albumPhotoRows.map((row) => ({
      albumId: row.album_id,
      photoId: row.photo_id,
      position: row.position,
      createdAt: row.created_at
    })),
    photos: photoRows.map((row) => mapPhoto(row, photoTags, photoAssets)),
    assets: assetRows.map(mapAsset),
    tags: rows<{
      id: string;
      slug: string;
      label: string;
      scope: AdminArchive["tags"][number]["scope"];
      color: string | null;
      created_at: string;
    }>(tagResult).map((row) => ({
      id: row.id,
      slug: row.slug,
      label: row.label,
      scope: row.scope,
      color: optional(row.color),
      createdAt: row.created_at
    })),
    collections: rows<{
      id: string;
      slug: string;
      title: string;
      description: string;
      status: ArchiveStatus;
      cover_asset_id: string | null;
      created_at: string;
      updated_at: string;
      published_at: string | null;
    }>(collectionResult).map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      description: row.description,
      status: row.status,
      coverAssetId: optional(row.cover_asset_id),
      photoIdsWithOrder: (collectionPhotos.get(row.id) ?? []).map((reference) => ({
        photoId: reference.photo_id,
        position: reference.position
      })),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      publishedAt: optional(row.published_at)
    })),
    settings: readSettings(rows<{ key: string; value: string }>(settingsResult)),
    trash: rows<{
      id: string;
      entity_type: AdminArchive["trash"][number]["entityType"];
      entity_id: string;
      title: string;
      deleted_at: string;
      purge_after: string;
      file_count: number;
      bytes: number;
    }>(trashResult).map((row) => ({
      id: row.id,
      entityType: row.entity_type,
      entityId: row.entity_id,
      title: row.title,
      deletedAt: row.deleted_at,
      purgeAfter: row.purge_after,
      fileCount: row.file_count,
      bytes: row.bytes
    })),
    uploadJobs: rows<{
      id: string;
      album_id: string;
      file_name: string;
      status: AdminArchive["uploadJobs"][number]["status"];
      progress: number;
      bytes: number;
      created_at: string;
    }>(uploadResult).map((row) => ({
      id: row.id,
      albumId: row.album_id,
      fileName: row.file_name,
      status: row.status,
      progress: row.progress,
      bytes: row.bytes,
      derivatives: [{ version: "sourceJpeg", status: "done", progress: 100 }],
      createdAt: row.created_at
    }))
  });
}

export async function createD1Album(
  db: Database,
  input: {
    title: string;
    subtitle?: string;
    status?: ArchiveStatus;
    publicDownloadPolicy?: PublicDownloadPolicy;
  }
): Promise<ArchiveAlbum> {
  const timestamp = new Date().toISOString();
  const slug = await uniqueSlug(db, "archive_albums", input.title);
  const id = `album-${slug}-${crypto.randomUUID().slice(0, 8)}`;
  const orderRow = await db
    .prepare("SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM archive_albums")
    .first<{ next_order: number }>();
  const album: ArchiveAlbum = {
    id,
    slug,
    title: input.title.trim(),
    subtitle: input.subtitle?.trim() ?? "",
    description: "",
    status: input.status ?? defaultAdminSettings.defaultAlbumStatus,
    isDemo: false,
    setIds: [],
    tagIds: [],
    publicDownloadPolicy: input.publicDownloadPolicy ?? defaultAdminSettings.publicDownloadMode,
    sortOrder: orderRow?.next_order ?? 0,
    photoOrderDirection: "forward",
    createdAt: timestamp,
    updatedAt: timestamp
  };

  await db
    .prepare(`
      INSERT INTO archive_albums (
        id, slug, title, subtitle, description, status, is_demo,
        public_download_policy, sort_order, photo_order_direction, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      album.id,
      album.slug,
      album.title,
      album.subtitle,
      album.description,
      album.status,
      0,
      album.publicDownloadPolicy,
      album.sortOrder,
      album.photoOrderDirection,
      album.createdAt,
      album.updatedAt
    )
    .run();

  return album;
}

export async function createD1PhotoUpload(
  env: Pick<CloudflareEnv, "DB" | "PRIVATE_ASSETS">,
  input: { albumId: string; file: File; height: number; title?: string; width: number }
) {
  const album = await env.DB
    .prepare("SELECT id FROM archive_albums WHERE id = ? AND status NOT IN ('trash', 'deleted')")
    .bind(input.albumId)
    .first<{ id: string }>();
  if (!album) throw new ArchiveWriteError("album_not_found", "Album was not found.", 404);

  const timestamp = new Date().toISOString();
  const baseTitle = input.title?.trim() || stripExtension(input.file.name) || "Untitled photo";
  const slug = await uniqueSlug(env.DB, "archive_photos", baseTitle);
  const photoId = `photo-${slug}-${crypto.randomUUID().slice(0, 8)}`;
  const assetId = `asset-${photoId.replace(/^photo-/, "")}-sourceJpeg`;
  const uploadId = `upload-${crypto.randomUUID()}`;
  const positionRow = await env.DB
    .prepare("SELECT COALESCE(MAX(position), 0) + 1 AS next_position FROM album_photos WHERE album_id = ?")
    .bind(album.id)
    .first<{ next_position: number }>();
  const position = positionRow?.next_position ?? 1;
  const objectKey = `source-jpeg/${album.id}/${photoId}/${safeFileName(input.file.name)}`;

  await env.PRIVATE_ASSETS.put(objectKey, input.file, {
    httpMetadata: { contentType: "image/jpeg" },
    customMetadata: { albumId: album.id, originalFileName: input.file.name, photoId }
  });

  try {
    await env.DB.batch([
      env.DB.prepare(`
        INSERT INTO archive_photos (
          id, slug, title, description, status, frame_number, width, height,
          dominant_color, created_at, updated_at
        ) VALUES (?, ?, ?, '', ?, ?, ?, ?, '#111111', ?, ?)
      `).bind(
        photoId,
        slug,
        baseTitle,
        defaultAdminSettings.defaultPhotoStatus,
        position,
        input.width,
        input.height,
        timestamp,
        timestamp
      ),
      env.DB
        .prepare("INSERT INTO album_photos (album_id, photo_id, position, created_at) VALUES (?, ?, ?, ?)")
        .bind(album.id, photoId, position, timestamp),
      env.DB.prepare(`
        INSERT INTO archive_assets (
          id, photo_id, version, access, bucket, object_key, width, height,
          bytes, mime_type, color_profile, created_at
        ) VALUES (?, ?, 'sourceJpeg', 'private', 'yakov-private-assets', ?, ?, ?, ?, 'image/jpeg', 'preserve', ?)
      `).bind(assetId, photoId, objectKey, input.width, input.height, input.file.size, timestamp),
      env.DB.prepare(`
        INSERT INTO upload_jobs (
          id, album_id, file_name, status, progress, bytes, created_at, updated_at
        ) VALUES (?, ?, ?, 'review', 100, ?, ?, ?)
      `).bind(uploadId, album.id, input.file.name, input.file.size, timestamp, timestamp),
      env.DB.prepare("UPDATE archive_albums SET updated_at = ? WHERE id = ?").bind(timestamp, album.id)
    ]);
  } catch (error) {
    await env.PRIVATE_ASSETS.delete(objectKey);
    throw error;
  }

  const photo: ArchivePhoto = {
    id: photoId,
    slug,
    title: baseTitle,
    description: "",
    status: defaultAdminSettings.defaultPhotoStatus,
    frameNumber: position,
    tagIds: [],
    assetIds: [assetId],
    width: input.width,
    height: input.height,
    dominantColor: "#111111",
    createdAt: timestamp,
    updatedAt: timestamp
  };
  const asset: ArchiveAsset = {
    id: assetId,
    photoId,
    version: "sourceJpeg",
    access: "private",
    bucket: "yakov-private-assets",
    key: objectKey,
    width: input.width,
    height: input.height,
    bytes: input.file.size,
    mimeType: "image/jpeg",
    colorProfile: "preserve",
    createdAt: timestamp
  };

  return {
    photo,
    albumPhoto: { albumId: album.id, photoId, position, createdAt: timestamp },
    asset,
    uploadJob: {
      id: uploadId,
      albumId: album.id,
      fileName: input.file.name,
      status: "review" as const,
      progress: 100,
      bytes: input.file.size,
      derivatives: [{ version: "sourceJpeg" as const, status: "done" as const, progress: 100 }],
      createdAt: timestamp
    },
    adminPreviewUrl: `/api/admin/assets/${assetId}`
  };
}

export async function findD1Asset(db: Database, assetId: string) {
  return db
    .prepare(`
      SELECT id, access, bucket, object_key, mime_type, bytes
      FROM archive_assets
      WHERE id = ?
    `)
    .bind(assetId)
    .first<{
      id: string;
      access: ArchiveAsset["access"];
      bucket: string;
      object_key: string;
      mime_type: string;
      bytes: number;
    }>();
}

export class ArchiveWriteError extends Error {
  constructor(readonly code: string, message: string, readonly status: number) {
    super(message);
  }
}

function mapAlbum(
  row: AlbumRow,
  albumSetIds: Map<string, string[]>,
  albumTags: Map<string, TagRefRow[]>
): ArchiveAlbum {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle,
    description: row.description,
    status: row.status,
    isDemo: Boolean(row.is_demo),
    setIds: albumSetIds.get(row.id) ?? [],
    tagIds: (albumTags.get(row.id) ?? []).map((reference) => reference.tag_id),
    publicDownloadPolicy: row.public_download_policy,
    coverLandscapeAssetId: optional(row.cover_landscape_asset_id),
    coverPortraitAssetId: optional(row.cover_portrait_asset_id),
    coverSquareAssetId: optional(row.cover_square_asset_id),
    sortOrder: row.sort_order,
    photoOrderDirection: row.photo_order_direction ?? "forward",
    dateStart: optional(row.date_start),
    dateEnd: optional(row.date_end),
    locationText: optional(row.location_text),
    camera: optional(row.camera),
    filmStock: optional(row.film_stock),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: optional(row.published_at),
    deletedAt: optional(row.deleted_at)
  };
}

function mapPhoto(
  row: PhotoRow,
  photoTags: Map<string, TagRefRow[]>,
  photoAssets: Map<string, AssetRow[]>
): ArchivePhoto {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    status: row.status,
    frameNumber: optional(row.frame_number),
    tagIds: (photoTags.get(row.id) ?? []).map((reference) => reference.tag_id),
    assetIds: (photoAssets.get(row.id) ?? []).map((asset) => asset.id),
    publicDownloadOverride: optional(row.public_download_override),
    dateTaken: optional(row.date_taken),
    locationText: optional(row.location_text),
    width: row.width,
    height: row.height,
    dominantColor: row.dominant_color,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: optional(row.published_at),
    hiddenAt: optional(row.hidden_at),
    deletedAt: optional(row.deleted_at)
  };
}

function mapAsset(row: AssetRow): ArchiveAsset {
  return {
    id: row.id,
    photoId: optional(row.photo_id),
    albumId: optional(row.album_id),
    version: row.version,
    access: row.access,
    bucket: row.bucket,
    key: row.object_key,
    publicUrl: optional(row.public_url),
    width: optional(row.width),
    height: optional(row.height),
    bytes: row.bytes,
    mimeType: row.mime_type,
    colorProfile: row.color_profile,
    createdAt: row.created_at
  };
}

function readSettings(values: Array<{ key: string; value: string }>) {
  const row = values.find((item) => item.key === "archive");
  if (!row) return defaultAdminSettings;

  try {
    return adminSettingsSchema.parse(JSON.parse(row.value));
  } catch {
    return defaultAdminSettings;
  }
}

async function uniqueSlug(db: Database, table: "archive_albums" | "archive_photos", title: string) {
  const base = slugify(title) || "untitled";
  const matches = await db
    .prepare(`SELECT slug FROM ${table} WHERE slug = ? OR slug LIKE ?`)
    .bind(base, `${base}-%`)
    .all<{ slug: string }>();
  const existing = new Set((matches.results ?? []).map((row: { slug: string }) => row.slug));
  if (!existing.has(base)) return base;

  let suffix = 2;
  while (existing.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function safeFileName(value: string) {
  const normalized = value.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-");
  return normalized.replace(/^-+|-+$/g, "") || "upload.jpg";
}

function stripExtension(value: string) {
  return value.replace(/\.[^.]+$/, "").trim();
}

function optional<T>(value: T | null): T | undefined {
  return value === null ? undefined : value;
}

function rows<T>(result: { results?: unknown[] }): T[] {
  return (result.results ?? []) as T[];
}

function groupBy<T>(values: T[], key: (value: T) => string) {
  const groups = new Map<string, T[]>();
  for (const value of values) {
    const groupKey = key(value);
    groups.set(groupKey, [...(groups.get(groupKey) ?? []), value]);
  }
  return groups;
}
