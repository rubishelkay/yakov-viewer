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
  cover_priority: ArchiveAlbum["coverPriority"] | null;
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
  const uploadRows = rows<{
    id: string;
    album_id: string;
    photo_id: string | null;
    file_name: string;
    status: AdminArchive["uploadJobs"][number]["status"];
    progress: number;
    bytes: number;
    created_at: string;
  }>(uploadResult);
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
  const uploadByPhotoId = new Map(
    uploadRows
      .filter((row): row is typeof row & { photo_id: string } => Boolean(row.photo_id))
      .map((row) => [row.photo_id, row])
  );
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
    photos: photoRows.map((row) => mapPhoto(
      row,
      photoTags,
      photoAssets,
      uploadByPhotoId.get(row.id)
    )),
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
      restore_status: ArchiveStatus | null;
      restore_payload: string | null;
    }>(trashResult).map((row) => ({
      id: row.id,
      entityType: row.entity_type,
      entityId: row.entity_id,
      title: row.title,
      deletedAt: row.deleted_at,
      purgeAfter: row.purge_after,
      fileCount: row.file_count,
      bytes: row.bytes,
      restoreStatus: optional(row.restore_status),
      ...readTrashRestorePayload(row.restore_payload)
    })),
    uploadJobs: uploadRows.map((row) => ({
      id: row.id,
      albumId: row.album_id,
      photoId: optional(row.photo_id),
      fileName: normalizeUploadFileName(row.file_name),
      status: row.status,
      progress: row.progress,
      bytes: row.bytes,
      derivatives: row.photo_id
        ? (photoAssets.get(row.photo_id) ?? []).map((asset) => ({
            version: asset.version,
            status: "done" as const,
            progress: 100
          }))
        : [{ version: "sourceJpeg" as const, status: "done" as const, progress: 100 }],
      createdAt: row.created_at
    }))
  });
}

export async function createD1Album(
  db: Database,
  input: {
    title: string;
    subtitle?: string;
    status?: Exclude<ArchiveStatus, "trash" | "deleted">;
    publicDownloadPolicy?: PublicDownloadPolicy;
  }
): Promise<ArchiveAlbum> {
  const settings = await readD1Settings(db);
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
    status: input.status ?? settings.defaultAlbumStatus,
    isDemo: false,
    setIds: [],
    tagIds: [],
    publicDownloadPolicy: input.publicDownloadPolicy ?? settings.publicDownloadMode,
    coverPriority: "landscape",
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
  env: Pick<
    CloudflareEnv,
    "DB" | "PUBLIC_ASSETS" | "NEXT_PUBLIC_ASSET_BASE_URL"
  >,
  input: {
    albumId: string;
    clientUploadId: string;
    display: { file: File; height: number; width: number };
    height: number;
    expanded: File;
    expandedBytes: number;
    expandedColorProfile: "preserve" | "srgb";
    expandedFileName: string;
    thumb: { file: File; height: number; width: number };
    title?: string;
    width: number;
  }
) {
  const photoId = `photo-${input.clientUploadId}`;
  const existingMembership = await env.DB
    .prepare("SELECT album_id FROM album_photos WHERE photo_id = ?")
    .bind(photoId)
    .first<{ album_id: string }>();
  if (existingMembership) {
    if (existingMembership.album_id !== input.albumId) {
      throw new ArchiveWriteError("upload_id_conflict", "This upload ID already belongs to another album.", 409);
    }
    return readExistingPhotoUpload(env.DB, photoId, input.clientUploadId);
  }

  const album = await env.DB
    .prepare("SELECT id FROM archive_albums WHERE id = ? AND status NOT IN ('trash', 'deleted')")
    .bind(input.albumId)
    .first<{ id: string }>();
  if (!album) throw new ArchiveWriteError("album_not_found", "Album was not found.", 404);

  const settings = await readD1Settings(env.DB);
  const timestamp = new Date().toISOString();
  const baseTitle = input.title?.trim() || stripExtension(input.expandedFileName) || "Untitled photo";
  const slug = await uniqueSlug(env.DB, "archive_photos", baseTitle);
  const assetStem = `asset-${input.clientUploadId}`;
  const expandedAssetId = `${assetStem}-expanded`;
  const thumbAssetId = `${assetStem}-thumb`;
  const displayAssetId = `${assetStem}-display`;
  const uploadId = `upload-${input.clientUploadId}`;
  const positionRow = await env.DB
    .prepare("SELECT COALESCE(MAX(position), 0) + 1 AS next_position FROM album_photos WHERE album_id = ?")
    .bind(album.id)
    .first<{ next_position: number }>();
  const position = positionRow?.next_position ?? 1;
  const expandedKey = `expanded/${album.id}/${photoId}/${safeFileName(input.expandedFileName)}`;
  const thumbKey = `thumb/${album.id}/${photoId}.jpg`;
  const displayKey = `display/${album.id}/${photoId}.jpg`;
  const publicBaseUrl = env.NEXT_PUBLIC_ASSET_BASE_URL.replace(/\/$/, "");
  const expandedAsset: ArchiveAsset = {
    id: expandedAssetId,
    photoId,
    version: "expanded",
    access: "public",
    bucket: "yakov-public-assets",
    key: expandedKey,
    publicUrl: `${publicBaseUrl}/${expandedKey}`,
    width: input.width,
    height: input.height,
    bytes: input.expanded.size,
    mimeType: "image/jpeg",
    colorProfile: input.expandedColorProfile,
    createdAt: timestamp
  };
  const thumbAsset: ArchiveAsset = {
    id: thumbAssetId,
    photoId,
    version: "thumb",
    access: "public",
    bucket: "yakov-public-assets",
    key: thumbKey,
    publicUrl: `${publicBaseUrl}/${thumbKey}`,
    width: input.thumb.width,
    height: input.thumb.height,
    bytes: input.thumb.file.size,
    mimeType: "image/jpeg",
    colorProfile: "srgb",
    createdAt: timestamp
  };
  const displayAsset: ArchiveAsset = {
    id: displayAssetId,
    photoId,
    version: "display",
    access: "public",
    bucket: "yakov-public-assets",
    key: displayKey,
    publicUrl: `${publicBaseUrl}/${displayKey}`,
    width: input.display.width,
    height: input.display.height,
    bytes: input.display.file.size,
    mimeType: "image/jpeg",
    colorProfile: "srgb",
    createdAt: timestamp
  };
  const assets: ArchiveAsset[] = [thumbAsset, displayAsset, expandedAsset];
  const storedObjects: Array<{ bucket: CloudflareEnv["PUBLIC_ASSETS"]; key: string }> = [];

  try {
    await env.PUBLIC_ASSETS.put(expandedKey, input.expanded, {
      httpMetadata: { cacheControl: "public, max-age=31536000, immutable", contentType: "image/jpeg" },
      customMetadata: {
        albumId: album.id,
        originalFileName: input.expandedFileName,
        photoId,
        version: "expanded"
      }
    });
    storedObjects.push({ bucket: env.PUBLIC_ASSETS, key: expandedKey });
    await env.PUBLIC_ASSETS.put(thumbKey, input.thumb.file, {
      httpMetadata: { cacheControl: "public, max-age=31536000, immutable", contentType: "image/jpeg" },
      customMetadata: { albumId: album.id, photoId, version: "thumb" }
    });
    storedObjects.push({ bucket: env.PUBLIC_ASSETS, key: thumbKey });
    await env.PUBLIC_ASSETS.put(displayKey, input.display.file, {
      httpMetadata: { cacheControl: "public, max-age=31536000, immutable", contentType: "image/jpeg" },
      customMetadata: { albumId: album.id, photoId, version: "display" }
    });
    storedObjects.push({ bucket: env.PUBLIC_ASSETS, key: displayKey });
  } catch (error) {
    try {
      return await readExistingPhotoUpload(env.DB, photoId, input.clientUploadId);
    } catch {
      await deleteStoredObjects(storedObjects);
      throw error;
    }
  }

  try {
    const statements = [
      env.DB.prepare(`
        INSERT INTO archive_photos (
          id, slug, title, description, status, frame_number, width, height,
          dominant_color, created_at, updated_at
        ) VALUES (?, ?, ?, '', ?, ?, ?, ?, '#111111', ?, ?)
      `).bind(
        photoId,
        slug,
        baseTitle,
        settings.defaultPhotoStatus,
        position,
        input.width,
        input.height,
        timestamp,
        timestamp
      ),
      env.DB
        .prepare("INSERT INTO album_photos (album_id, photo_id, position, created_at) VALUES (?, ?, ?, ?)")
        .bind(album.id, photoId, position, timestamp),
      ...assets.map((asset) => env.DB.prepare(`
          INSERT INTO archive_assets (
            id, photo_id, version, access, bucket, object_key, public_url, width, height,
            bytes, mime_type, color_profile, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          asset.id,
          photoId,
          asset.version,
          asset.access,
          asset.bucket,
          asset.key,
          asset.publicUrl ?? null,
          asset.width ?? null,
          asset.height ?? null,
          asset.bytes,
          asset.mimeType,
          asset.colorProfile,
          timestamp
        )),
      env.DB.prepare(`
        INSERT INTO upload_jobs (
          id, album_id, photo_id, file_name, status, progress, bytes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'review', 100, ?, ?, ?)
      `).bind(uploadId, album.id, photoId, input.expandedFileName, input.expandedBytes, timestamp, timestamp),
      env.DB.prepare(`
        UPDATE archive_albums
        SET cover_landscape_asset_id = COALESCE(cover_landscape_asset_id, ?),
            cover_portrait_asset_id = COALESCE(cover_portrait_asset_id, ?),
            cover_square_asset_id = COALESCE(cover_square_asset_id, ?),
            updated_at = ?
        WHERE id = ?
      `).bind(displayAssetId, displayAssetId, thumbAssetId, timestamp, album.id)
    ];
    await env.DB.batch(statements);
  } catch (error) {
    try {
      return await readExistingPhotoUpload(env.DB, photoId, input.clientUploadId);
    } catch {
      await deleteStoredObjects(storedObjects);
      throw error;
    }
  }

  const photo: ArchivePhoto = {
    id: photoId,
    slug,
    title: baseTitle,
    description: "",
    status: settings.defaultPhotoStatus,
    frameNumber: position,
    tagIds: [],
    assetIds: assets.map((asset) => asset.id),
    width: input.width,
    height: input.height,
    dominantColor: "#111111",
    createdAt: timestamp,
    updatedAt: timestamp
  };

  return {
    photo,
    albumPhoto: { albumId: album.id, photoId, position, createdAt: timestamp },
    asset: expandedAsset,
    assets,
    uploadJob: {
      id: uploadId,
      albumId: album.id,
      photoId,
      fileName: input.expandedFileName,
      status: "review" as const,
      progress: 100,
      bytes: input.expandedBytes,
      derivatives: assets.map((asset) => ({
        version: asset.version,
        status: "done" as const,
        progress: 100
      })),
      createdAt: timestamp
    },
    adminPreviewUrl: `/api/admin/assets/${displayAssetId}`
  };
}

async function readExistingPhotoUpload(db: Database, photoId: string, clientUploadId: string) {
  const archive = await readD1Archive(db);
  const photo = archive.photos.find((item) => item.id === photoId);
  const albumPhoto = archive.albumPhotos.find((item) => item.photoId === photoId);
  const assets = archive.assets.filter((item) => item.photoId === photoId);
  const uploadJob = archive.uploadJobs.find((item) => item.id === `upload-${clientUploadId}`);
  const expandedAsset = assets.find((asset) => asset.version === "expanded")
    ?? assets.find((asset) => asset.version === "sourceJpeg");
  const previewAsset = assets.find((asset) => asset.version === "display");
  if (!photo || !albumPhoto || !expandedAsset || !previewAsset || !uploadJob) {
    throw new ArchiveWriteError("upload_incomplete", "The previous upload is incomplete.", 409);
  }

  return {
    photo,
    albumPhoto,
    asset: expandedAsset,
    assets,
    uploadJob: {
      ...uploadJob,
      derivatives: assets.map((asset) => ({
        version: asset.version,
        status: "done" as const,
        progress: 100
      }))
    },
    adminPreviewUrl: `/api/admin/assets/${previewAsset.id}`
  };
}

async function deleteStoredObjects(
  objects: Array<{ bucket: CloudflareEnv["PUBLIC_ASSETS"]; key: string }>
) {
  await Promise.allSettled(objects.map(({ bucket, key }) => bucket.delete(key)));
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
    coverPriority: row.cover_priority ?? "landscape",
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
  photoAssets: Map<string, AssetRow[]>,
  upload?: { bytes: number; file_name: string }
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
    sourceFileName: upload ? normalizeUploadFileName(upload.file_name) : undefined,
    sourceBytes: upload?.bytes,
    mimeType: upload ? "image/jpeg" : undefined,
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

async function readD1Settings(db: Database) {
  const row = await db.prepare("SELECT value FROM admin_settings WHERE key = 'archive'")
    .first<{ value: string }>();
  if (!row) return defaultAdminSettings;
  try {
    return adminSettingsSchema.parse(JSON.parse(row.value));
  } catch {
    return defaultAdminSettings;
  }
}

function readTrashRestorePayload(value: string | null) {
  if (!value) return {};

  try {
    return trashRestorePayloadSchema.parse(JSON.parse(value));
  } catch {
    return {};
  }
}

const trashRestorePayloadSchema = adminArchiveSchema.shape.trash.element.pick({
  restorePhotoStatuses: true,
  restoreSetRefs: true
}).partial();

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

function normalizeUploadFileName(value: string) {
  return value.replace(/(?:\.jpe?g){2,}$/i, (extensions) => (
    extensions.toLowerCase().includes(".jpeg") ? ".jpeg" : ".jpg"
  ));
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
