import "server-only";

import {
  adminSettingsSchema,
  type AdminSettings,
  type ArchiveStatus
} from "@/admin/archive-schema";
import type { CloudArchiveMutation } from "@/admin/cloudflare-mutations";
import { defaultAdminSettings } from "@/admin/default-settings";

type Database = CloudflareEnv["DB"];
type MutationEnv = Pick<CloudflareEnv, "DB" | "PRIVATE_ASSETS" | "PUBLIC_ASSETS">;
type MutationResult = { id?: string };
type TrashRow = {
  id: string;
  entity_type: "set" | "album" | "photo" | "asset" | "collection";
  entity_id: string;
  restore_status: ArchiveStatus | null;
  restore_payload: string | null;
};
type StoredObject = { bucket: string; key: string };
type RestorePayload = {
  restorePhotoStatuses?: Array<{
    photoId: string;
    status: ArchiveStatus;
    hiddenAt?: string;
  }>;
  restoreSetRefs?: Array<{
    setId: string;
    albumRef: {
      albumId: string;
      position: number;
      featured: boolean;
    };
  }>;
};

export async function applyD1ArchiveMutation(
  env: MutationEnv,
  mutation: CloudArchiveMutation
): Promise<MutationResult> {
  switch (mutation.action) {
    case "updateAlbum":
      return updateAlbum(env.DB, mutation.albumId, mutation.update);
    case "reorderAlbum":
      return reorderAlbum(env.DB, mutation.albumId, mutation.direction);
    case "moveAlbum":
      return moveAlbum(env.DB, mutation.albumId, mutation.position);
    case "trashAlbum":
      return trashAlbum(env.DB, mutation.albumId);
    case "updatePhoto":
      return updatePhoto(env.DB, mutation.photoId, mutation.update);
    case "movePhoto":
      return movePhoto(env.DB, mutation.albumId, mutation.photoId, mutation.position);
    case "trashPhoto":
      return trashPhoto(env.DB, mutation.photoId);
    case "setAlbumCover":
      return setAlbumCover(env.DB, mutation.albumId, mutation.coverType, mutation.assetId);
    case "addPhotoToAlbum":
      return addPhotoToAlbum(env.DB, mutation.albumId, mutation.photoId);
    case "removePhotoFromAlbum":
      return removePhotoFromAlbum(env.DB, mutation.albumId, mutation.photoId);
    case "createSet":
      return createSet(env.DB, mutation);
    case "updateSet":
      return updateSet(env.DB, mutation.setId, mutation.update);
    case "trashSet":
      return trashSet(env.DB, mutation.setId);
    case "reorderSet":
      return reorderSet(env.DB, mutation.setId, mutation.direction);
    case "addAlbumToSet":
      return addAlbumToSet(env.DB, mutation.setId, mutation.albumId);
    case "removeAlbumFromSet":
      return removeAlbumFromSet(env.DB, mutation.setId, mutation.albumId);
    case "reorderAlbumInSet":
      return reorderAlbumInSet(env.DB, mutation.setId, mutation.albumId, mutation.direction);
    case "createTag":
      return createTag(env.DB, mutation.label, mutation.scope ?? "both");
    case "updateTag":
      return updateTag(env.DB, mutation.tagId, mutation.update);
    case "deleteTag":
      return deleteTag(env.DB, mutation.tagId);
    case "attachAlbumTag":
      return attachAlbumTag(env.DB, mutation.albumId, mutation.tagId);
    case "detachAlbumTag":
      return detachAlbumTag(env.DB, mutation.albumId, mutation.tagId);
    case "updateSettings":
      return updateSettings(env.DB, mutation.update);
    case "restoreItem":
      return restoreItem(env.DB, mutation.itemId);
    case "purgeItem":
      return purgeItem(env, mutation.itemId);
  }
}

async function updateAlbum(
  db: Database,
  albumId: string,
  update: Extract<CloudArchiveMutation, { action: "updateAlbum" }>["update"]
) {
  const album = await db.prepare("SELECT * FROM archive_albums WHERE id = ?").bind(albumId).first<{
    title: string;
    subtitle: string;
    status: ArchiveStatus;
    public_download_policy: string;
    photo_order_direction: string;
    cover_priority: string;
    published_at: string | null;
  }>();
  if (!album) throw notFound("album");

  const timestamp = now();
  const status = update.status ?? album.status;
  const statements = [
    db.prepare(`
      UPDATE archive_albums
      SET title = ?, subtitle = ?, status = ?, public_download_policy = ?,
          photo_order_direction = ?, cover_priority = ?, updated_at = ?,
          published_at = CASE WHEN ? = 'published' THEN COALESCE(published_at, ?) ELSE published_at END,
          deleted_at = NULL
      WHERE id = ?
    `).bind(
      update.title ?? album.title,
      update.subtitle ?? album.subtitle,
      status,
      update.publicDownloadPolicy ?? album.public_download_policy,
      update.photoOrderDirection ?? album.photo_order_direction,
      update.coverPriority ?? album.cover_priority,
      timestamp,
      status,
      timestamp,
      albumId
    )
  ];

  if (status === "published" && album.status !== "published") {
    statements.push(
      db.prepare(`
        UPDATE archive_photos
        SET status = 'published', published_at = COALESCE(published_at, ?), updated_at = ?
        WHERE id IN (SELECT photo_id FROM album_photos WHERE album_id = ?)
          AND status IN ('draft', 'review')
      `).bind(timestamp, timestamp, albumId)
    );
  }

  await db.batch(statements);
  return { id: albumId };
}

async function reorderAlbum(db: Database, albumId: string, direction: "up" | "down") {
  const rows = await db.prepare(`
    SELECT id, sort_order FROM archive_albums
    WHERE status NOT IN ('trash', 'deleted')
    ORDER BY sort_order, created_at
  `).all<{ id: string; sort_order: number }>();
  const ordered = resultRows<{ id: string; sort_order: number }>(rows);
  const index = ordered.findIndex((row) => row.id === albumId);
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (index < 0) throw notFound("album");
  if (!ordered[swapIndex]) return { id: albumId };

  const timestamp = now();
  await db.batch([
    db.prepare("UPDATE archive_albums SET sort_order = ?, updated_at = ? WHERE id = ?")
      .bind(ordered[swapIndex].sort_order, timestamp, albumId),
    db.prepare("UPDATE archive_albums SET sort_order = ?, updated_at = ? WHERE id = ?")
      .bind(ordered[index].sort_order, timestamp, ordered[swapIndex].id)
  ]);
  return { id: albumId };
}

async function moveAlbum(db: Database, albumId: string, position: number) {
  const result = await db.prepare(`
    SELECT id FROM archive_albums
    WHERE status NOT IN ('trash', 'deleted')
    ORDER BY sort_order, created_at
  `).all<{ id: string }>();
  const ordered = resultRows<{ id: string }>(result);
  const index = ordered.findIndex((row) => row.id === albumId);
  if (index < 0) throw notFound("album");
  const [moved] = ordered.splice(index, 1);
  ordered.splice(clamp(position, 0, ordered.length), 0, moved);
  const timestamp = now();
  await db.batch(ordered.map((row, nextPosition) =>
    db.prepare("UPDATE archive_albums SET sort_order = ?, updated_at = ? WHERE id = ?")
      .bind(nextPosition, timestamp, row.id)
  ));
  return { id: albumId };
}

async function updatePhoto(
  db: Database,
  photoId: string,
  update: Extract<CloudArchiveMutation, { action: "updatePhoto" }>["update"]
) {
  const photo = await db.prepare("SELECT * FROM archive_photos WHERE id = ?").bind(photoId).first<{
    title: string;
    status: ArchiveStatus;
    public_download_override: string | null;
    published_at: string | null;
    hidden_at: string | null;
  }>();
  if (!photo) throw notFound("photo");

  const timestamp = now();
  const status = update.status ?? photo.status;
  const statements = [
    db.prepare(`
      UPDATE archive_photos
      SET title = ?, status = ?, public_download_override = ?, updated_at = ?,
          published_at = CASE WHEN ? = 'published' THEN COALESCE(published_at, ?) ELSE published_at END,
          hidden_at = CASE WHEN ? = 'hidden' THEN COALESCE(hidden_at, ?) ELSE NULL END,
          deleted_at = NULL
      WHERE id = ?
    `).bind(
      update.title ?? photo.title,
      status,
      update.publicDownloadOverride === undefined
        ? photo.public_download_override
        : update.publicDownloadOverride,
      timestamp,
      status,
      timestamp,
      status,
      timestamp,
      photoId
    )
  ];

  if (update.tagIds) {
    await assertIdsExist(db, "archive_tags", update.tagIds);
    statements.push(db.prepare("DELETE FROM photo_tags WHERE photo_id = ?").bind(photoId));
    statements.push(
      ...update.tagIds.map((tagId) =>
        db.prepare("INSERT INTO photo_tags (photo_id, tag_id) VALUES (?, ?)").bind(photoId, tagId)
      )
    );
  }

  await db.batch(statements);
  return { id: photoId };
}

async function movePhoto(db: Database, albumId: string, photoId: string, position: number) {
  const result = await db.prepare(`
    SELECT photo_id, position FROM album_photos
    WHERE album_id = ? ORDER BY position
  `).bind(albumId).all<{ photo_id: string; position: number }>();
  const ordered = resultRows<{ photo_id: string; position: number }>(result);
  const currentIndex = ordered.findIndex((row) => row.photo_id === photoId);
  if (currentIndex < 0) throw new ArchiveMutationError("membership_not_found", "Photo is not in this album.", 404);

  const [moved] = ordered.splice(currentIndex, 1);
  ordered.splice(clamp(position - 1, 0, ordered.length), 0, moved);
  await db.batch(ordered.map((row, index) =>
    db.prepare("UPDATE album_photos SET position = ? WHERE album_id = ? AND photo_id = ?")
      .bind(index + 1, albumId, row.photo_id)
  ));
  return { id: photoId };
}

async function setAlbumCover(
  db: Database,
  albumId: string,
  coverType: "landscape" | "portrait" | "square",
  assetId: string
) {
  const asset = await db.prepare(`
    SELECT aa.id FROM archive_assets aa
    JOIN album_photos ap ON ap.photo_id = aa.photo_id
    WHERE aa.id = ? AND ap.album_id = ? AND aa.access = 'public'
  `).bind(assetId, albumId).first();
  if (!asset) throw new ArchiveMutationError("invalid_cover", "Cover asset is not part of this album.", 409);

  const column = {
    landscape: "cover_landscape_asset_id",
    portrait: "cover_portrait_asset_id",
    square: "cover_square_asset_id"
  }[coverType];
  await db.prepare(`UPDATE archive_albums SET ${column} = ?, updated_at = ? WHERE id = ?`)
    .bind(assetId, now(), albumId)
    .run();
  return { id: albumId };
}

async function addPhotoToAlbum(db: Database, albumId: string, photoId: string) {
  const [album, photo, existing] = await Promise.all([
    db.prepare("SELECT id FROM archive_albums WHERE id = ? AND status NOT IN ('trash', 'deleted')")
      .bind(albumId).first(),
    db.prepare("SELECT id FROM archive_photos WHERE id = ? AND status NOT IN ('trash', 'deleted')")
      .bind(photoId).first(),
    db.prepare("SELECT photo_id FROM album_photos WHERE album_id = ? AND photo_id = ?")
      .bind(albumId, photoId).first()
  ]);
  if (!album) throw notFound("album");
  if (!photo) throw notFound("photo");
  if (existing) return { id: photoId };

  const position = await nextPosition(db, "album_photos", "album_id", albumId);
  const display = await db.prepare(`
    SELECT id FROM archive_assets WHERE photo_id = ? AND version = 'display' LIMIT 1
  `).bind(photoId).first<{ id: string }>();
  const thumb = await db.prepare(`
    SELECT id FROM archive_assets WHERE photo_id = ? AND version = 'thumb' LIMIT 1
  `).bind(photoId).first<{ id: string }>();
  const timestamp = now();
  await db.batch([
    db.prepare("INSERT INTO album_photos (album_id, photo_id, position, created_at) VALUES (?, ?, ?, ?)")
      .bind(albumId, photoId, position, timestamp),
    db.prepare(`
      UPDATE archive_albums
      SET cover_landscape_asset_id = COALESCE(cover_landscape_asset_id, ?),
          cover_portrait_asset_id = COALESCE(cover_portrait_asset_id, ?),
          cover_square_asset_id = COALESCE(cover_square_asset_id, ?),
          updated_at = ?
      WHERE id = ?
    `).bind(display?.id ?? null, display?.id ?? null, thumb?.id ?? null, timestamp, albumId)
  ]);
  return { id: photoId };
}

async function removePhotoFromAlbum(db: Database, albumId: string, photoId: string) {
  const memberships = await db.prepare(`
    SELECT album_id FROM album_photos WHERE photo_id = ?
  `).bind(photoId).all<{ album_id: string }>();
  const rows = resultRows<{ album_id: string }>(memberships);
  if (!rows.some((row) => row.album_id === albumId)) {
    throw new ArchiveMutationError("membership_not_found", "Photo is not in this album.", 404);
  }
  if (rows.length <= 1) {
    throw new ArchiveMutationError(
      "last_membership",
      "Move the photo to the Bin instead of removing its final album membership.",
      409
    );
  }

  await db.prepare("DELETE FROM album_photos WHERE album_id = ? AND photo_id = ?")
    .bind(albumId, photoId)
    .run();
  await normalizeAlbumPositions(db, albumId);
  await repairAlbumCovers(db, albumId, photoId);
  return { id: photoId };
}

async function createSet(
  db: Database,
  input: Extract<CloudArchiveMutation, { action: "createSet" }>
) {
  const timestamp = now();
  const slug = await uniqueSlug(db, "archive_sets", input.title);
  const id = `set-${slug}-${crypto.randomUUID().slice(0, 8)}`;
  const order = await nextSortOrder(db, "archive_sets");
  await db.prepare(`
    INSERT INTO archive_sets (
      id, slug, title, subtitle, description, status, sort_order, layout_mode,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    slug,
    input.title,
    input.subtitle ?? "",
    input.subtitle ?? "",
    input.status ?? "draft",
    order,
    input.layoutMode ?? "six-grid",
    timestamp,
    timestamp
  ).run();
  return { id };
}

async function updateSet(
  db: Database,
  setId: string,
  update: Extract<CloudArchiveMutation, { action: "updateSet" }>["update"]
) {
  const set = await db.prepare("SELECT * FROM archive_sets WHERE id = ?").bind(setId).first<{
    title: string;
    subtitle: string;
    status: ArchiveStatus;
    layout_mode: string;
    published_at: string | null;
  }>();
  if (!set) throw notFound("set");
  const timestamp = now();
  const status = update.status ?? set.status;
  await db.prepare(`
    UPDATE archive_sets
    SET title = ?, subtitle = ?, description = ?, status = ?, layout_mode = ?, updated_at = ?,
        published_at = CASE WHEN ? = 'published' THEN COALESCE(published_at, ?) ELSE published_at END,
        deleted_at = NULL
    WHERE id = ?
  `).bind(
    update.title ?? set.title,
    update.subtitle ?? set.subtitle,
    update.subtitle ?? set.subtitle,
    status,
    update.layoutMode ?? set.layout_mode,
    timestamp,
    status,
    timestamp,
    setId
  ).run();
  return { id: setId };
}

async function reorderSet(db: Database, setId: string, direction: "up" | "down") {
  const result = await db.prepare(`
    SELECT id, sort_order FROM archive_sets
    WHERE status NOT IN ('trash', 'deleted') ORDER BY sort_order, created_at
  `).all<{ id: string; sort_order: number }>();
  const ordered = resultRows<{ id: string; sort_order: number }>(result);
  const index = ordered.findIndex((row) => row.id === setId);
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (index < 0) throw notFound("set");
  if (!ordered[swapIndex]) return { id: setId };

  const timestamp = now();
  await db.batch([
    db.prepare("UPDATE archive_sets SET sort_order = ?, updated_at = ? WHERE id = ?")
      .bind(ordered[swapIndex].sort_order, timestamp, setId),
    db.prepare("UPDATE archive_sets SET sort_order = ?, updated_at = ? WHERE id = ?")
      .bind(ordered[index].sort_order, timestamp, ordered[swapIndex].id)
  ]);
  return { id: setId };
}

async function addAlbumToSet(db: Database, setId: string, albumId: string) {
  const [set, album, existing] = await Promise.all([
    db.prepare("SELECT id FROM archive_sets WHERE id = ? AND status NOT IN ('trash', 'deleted')").bind(setId).first(),
    db.prepare("SELECT id FROM archive_albums WHERE id = ? AND status NOT IN ('trash', 'deleted')").bind(albumId).first(),
    db.prepare("SELECT album_id FROM set_albums WHERE set_id = ? AND album_id = ?").bind(setId, albumId).first()
  ]);
  if (!set) throw notFound("set");
  if (!album) throw notFound("album");
  if (existing) return { id: albumId };

  const position = await nextPosition(db, "set_albums", "set_id", setId, 0);
  await db.prepare("INSERT INTO set_albums (set_id, album_id, position, featured) VALUES (?, ?, ?, ?)")
    .bind(setId, albumId, position, position === 0 ? 1 : 0)
    .run();
  return { id: albumId };
}

async function removeAlbumFromSet(db: Database, setId: string, albumId: string) {
  await db.prepare("DELETE FROM set_albums WHERE set_id = ? AND album_id = ?").bind(setId, albumId).run();
  await normalizeSetPositions(db, setId);
  return { id: albumId };
}

async function reorderAlbumInSet(
  db: Database,
  setId: string,
  albumId: string,
  direction: "left" | "right"
) {
  const result = await db.prepare(`
    SELECT album_id, position FROM set_albums WHERE set_id = ? ORDER BY position
  `).bind(setId).all<{ album_id: string; position: number }>();
  const ordered = resultRows<{ album_id: string; position: number }>(result);
  const index = ordered.findIndex((row) => row.album_id === albumId);
  const swapIndex = direction === "left" ? index - 1 : index + 1;
  if (index < 0) throw new ArchiveMutationError("membership_not_found", "Album is not in this set.", 404);
  if (!ordered[swapIndex]) return { id: albumId };

  await db.batch([
    db.prepare("UPDATE set_albums SET position = ? WHERE set_id = ? AND album_id = ?")
      .bind(ordered[swapIndex].position, setId, albumId),
    db.prepare("UPDATE set_albums SET position = ? WHERE set_id = ? AND album_id = ?")
      .bind(ordered[index].position, setId, ordered[swapIndex].album_id)
  ]);
  return { id: albumId };
}

async function createTag(db: Database, label: string, scope: "album" | "photo" | "both") {
  const baseSlug = slugify(label) || "tag";
  const existing = await db.prepare("SELECT id FROM archive_tags WHERE slug = ? OR lower(label) = lower(?)")
    .bind(baseSlug, label)
    .first<{ id: string }>();
  if (existing) return { id: existing.id };

  const slug = await uniqueSlug(db, "archive_tags", label);
  const id = `tag-${slug}-${crypto.randomUUID().slice(0, 8)}`;
  await db.prepare(`
    INSERT INTO archive_tags (id, slug, label, scope, created_at) VALUES (?, ?, ?, ?, ?)
  `).bind(id, slug, label, scope, now()).run();
  return { id };
}

async function updateTag(
  db: Database,
  tagId: string,
  update: Extract<CloudArchiveMutation, { action: "updateTag" }>["update"]
) {
  const tag = await db.prepare("SELECT label, scope FROM archive_tags WHERE id = ?").bind(tagId).first<{
    label: string;
    scope: string;
  }>();
  if (!tag) throw notFound("tag");
  await db.prepare("UPDATE archive_tags SET label = ?, scope = ? WHERE id = ?")
    .bind(update.label ?? tag.label, update.scope ?? tag.scope, tagId)
    .run();
  return { id: tagId };
}

async function deleteTag(db: Database, tagId: string) {
  const usage = await db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM album_tags WHERE tag_id = ?) +
      (SELECT COUNT(*) FROM photo_tags WHERE tag_id = ?) AS total
  `).bind(tagId, tagId).first<{ total: number }>();
  if (!usage) throw notFound("tag");
  if (usage.total > 0) {
    throw new ArchiveMutationError("tag_in_use", "Remove this tag from albums and photos first.", 409);
  }
  await db.prepare("DELETE FROM archive_tags WHERE id = ?").bind(tagId).run();
  return { id: tagId };
}

async function attachAlbumTag(db: Database, albumId: string, tagId: string) {
  await assertIdsExist(db, "archive_albums", [albumId]);
  await assertIdsExist(db, "archive_tags", [tagId]);
  await db.prepare("INSERT OR IGNORE INTO album_tags (album_id, tag_id) VALUES (?, ?)")
    .bind(albumId, tagId)
    .run();
  return { id: tagId };
}

async function detachAlbumTag(db: Database, albumId: string, tagId: string) {
  await db.prepare("DELETE FROM album_tags WHERE album_id = ? AND tag_id = ?")
    .bind(albumId, tagId)
    .run();
  return { id: tagId };
}

async function updateSettings(db: Database, update: Partial<AdminSettings>) {
  const settings = { ...await readSettings(db), ...update };
  const parsed = adminSettingsSchema.parse(settings);
  const timestamp = now();
  await db.prepare(`
    INSERT INTO admin_settings (key, value, updated_at) VALUES ('archive', ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).bind(JSON.stringify(parsed), timestamp).run();
  return {};
}

async function trashAlbum(db: Database, albumId: string) {
  const album = await db.prepare(`
    SELECT id, title, status FROM archive_albums WHERE id = ? AND status NOT IN ('trash', 'deleted')
  `).bind(albumId).first<{ id: string; title: string; status: ArchiveStatus }>();
  if (!album) throw notFound("album");

  const setRefs = await db.prepare(`
    SELECT set_id, album_id, position, featured FROM set_albums WHERE album_id = ?
  `).bind(albumId).all<{ set_id: string; album_id: string; position: number; featured: number }>();
  const orphanPhotos = await db.prepare(`
    SELECT p.id, p.status, p.hidden_at
    FROM archive_photos p
    JOIN album_photos target ON target.photo_id = p.id AND target.album_id = ?
    WHERE NOT EXISTS (
      SELECT 1 FROM album_photos other
      WHERE other.photo_id = p.id AND other.album_id != ?
    )
  `).bind(albumId, albumId).all<{ id: string; status: ArchiveStatus; hidden_at: string | null }>();
  const orphanPhotoRows = resultRows<{ id: string; status: ArchiveStatus; hidden_at: string | null }>(orphanPhotos);
  const setReferenceRows = resultRows<{ set_id: string; album_id: string; position: number; featured: number }>(setRefs);
  const orphanIds = orphanPhotoRows.map((photo) => photo.id);
  const storage = await assetSummary(db, orphanIds);
  const timestamp = now();
  const itemId = `trash-album-${crypto.randomUUID()}`;
  const settings = await readSettings(db);
  const payload = {
    restorePhotoStatuses: orphanPhotoRows.map((photo) => ({
      photoId: photo.id,
      status: photo.status,
      ...(photo.hidden_at ? { hiddenAt: photo.hidden_at } : {})
    })),
    restoreSetRefs: setReferenceRows.map((row) => ({
      setId: row.set_id,
      albumRef: {
        albumId: row.album_id,
        position: row.position,
        featured: Boolean(row.featured)
      }
    }))
  };
  const statements = [
    db.prepare(`
      UPDATE archive_albums SET status = 'trash', deleted_at = ?, updated_at = ? WHERE id = ?
    `).bind(timestamp, timestamp, albumId),
    db.prepare("DELETE FROM set_albums WHERE album_id = ?").bind(albumId),
    db.prepare(`
      INSERT INTO trash_items (
        id, entity_type, entity_id, title, deleted_at, purge_after,
        file_count, bytes, restore_status, restore_payload
      ) VALUES (?, 'album', ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      itemId,
      albumId,
      album.title,
      timestamp,
      purgeAfter(timestamp, settings.trashRetentionDays),
      storage.fileCount,
      storage.bytes,
      album.status,
      JSON.stringify(payload)
    )
  ];
  statements.push(...orphanIds.map((photoId) =>
    db.prepare(`
      UPDATE archive_photos SET status = 'trash', deleted_at = ?, updated_at = ? WHERE id = ?
    `).bind(timestamp, timestamp, photoId)
  ));
  await db.batch(statements);
  for (const setId of new Set(setReferenceRows.map((row) => row.set_id))) {
    await normalizeSetPositions(db, setId);
  }
  return { id: itemId };
}

async function trashPhoto(db: Database, photoId: string) {
  const photo = await db.prepare(`
    SELECT id, title, status FROM archive_photos WHERE id = ? AND status NOT IN ('trash', 'deleted')
  `).bind(photoId).first<{ id: string; title: string; status: ArchiveStatus }>();
  if (!photo) throw notFound("photo");

  const storage = await assetSummary(db, [photoId]);
  const timestamp = now();
  const itemId = `trash-photo-${crypto.randomUUID()}`;
  const settings = await readSettings(db);
  await db.batch([
    db.prepare(`
      UPDATE archive_photos SET status = 'trash', deleted_at = ?, updated_at = ? WHERE id = ?
    `).bind(timestamp, timestamp, photoId),
    db.prepare(`
      INSERT INTO trash_items (
        id, entity_type, entity_id, title, deleted_at, purge_after,
        file_count, bytes, restore_status
      ) VALUES (?, 'photo', ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      itemId,
      photoId,
      photo.title,
      timestamp,
      purgeAfter(timestamp, settings.trashRetentionDays),
      storage.fileCount,
      storage.bytes,
      photo.status
    )
  ]);
  return { id: itemId };
}

async function trashSet(db: Database, setId: string) {
  const set = await db.prepare(`
    SELECT id, title, status FROM archive_sets WHERE id = ? AND status NOT IN ('trash', 'deleted')
  `).bind(setId).first<{ id: string; title: string; status: ArchiveStatus }>();
  if (!set) throw notFound("set");
  const timestamp = now();
  const itemId = `trash-set-${crypto.randomUUID()}`;
  const settings = await readSettings(db);
  await db.batch([
    db.prepare(`
      UPDATE archive_sets SET status = 'trash', deleted_at = ?, updated_at = ? WHERE id = ?
    `).bind(timestamp, timestamp, setId),
    db.prepare(`
      INSERT INTO trash_items (
        id, entity_type, entity_id, title, deleted_at, purge_after,
        file_count, bytes, restore_status
      ) VALUES (?, 'set', ?, ?, ?, ?, 0, 0, ?)
    `).bind(itemId, setId, set.title, timestamp, purgeAfter(timestamp, settings.trashRetentionDays), set.status)
  ]);
  return { id: itemId };
}

async function restoreItem(db: Database, itemId: string) {
  const item = await readTrashItem(db, itemId);
  const timestamp = now();
  const status = item.restore_status ?? "draft";
  const payload = readRestorePayload(item.restore_payload);
  const statements = [];

  if (item.entity_type === "album") {
    statements.push(
      db.prepare(`
        UPDATE archive_albums SET status = ?, deleted_at = NULL, updated_at = ? WHERE id = ?
      `).bind(status, timestamp, item.entity_id)
    );
    for (const photo of payload.restorePhotoStatuses ?? []) {
      statements.push(
        db.prepare(`
          UPDATE archive_photos
          SET status = ?, hidden_at = ?, deleted_at = NULL, updated_at = ?
          WHERE id = ?
        `).bind(photo.status, photo.hiddenAt ?? null, timestamp, photo.photoId)
      );
    }
    for (const reference of payload.restoreSetRefs ?? []) {
      statements.push(
        db.prepare(`
          INSERT OR REPLACE INTO set_albums (set_id, album_id, position, featured)
          VALUES (?, ?, ?, ?)
        `).bind(
          reference.setId,
          reference.albumRef.albumId,
          reference.albumRef.position,
          reference.albumRef.featured ? 1 : 0
        )
      );
    }
  } else if (item.entity_type === "photo") {
    statements.push(
      db.prepare(`
        UPDATE archive_photos
        SET status = ?, hidden_at = CASE WHEN ? = 'hidden' THEN hidden_at ELSE NULL END,
            deleted_at = NULL, updated_at = ?
        WHERE id = ?
      `).bind(status, status, timestamp, item.entity_id)
    );
  } else if (item.entity_type === "set") {
    statements.push(
      db.prepare(`
        UPDATE archive_sets SET status = ?, deleted_at = NULL, updated_at = ? WHERE id = ?
      `).bind(status, timestamp, item.entity_id)
    );
  } else {
    throw new ArchiveMutationError("restore_unsupported", "This item cannot be restored yet.", 409);
  }

  statements.push(db.prepare("DELETE FROM trash_items WHERE id = ?").bind(itemId));
  await db.batch(statements);
  if (item.entity_type === "album") {
    for (const setId of new Set((payload.restoreSetRefs ?? []).map((reference) => reference.setId))) {
      await normalizeSetPositions(db, setId);
    }
  }
  return { id: item.entity_id };
}

async function purgeItem(env: MutationEnv, itemId: string) {
  const item = await readTrashItem(env.DB, itemId);
  let job = await env.DB.prepare(`
    SELECT id, object_manifest FROM purge_jobs WHERE trash_item_id = ?
  `).bind(itemId).first<{ id: string; object_manifest: string }>();

  if (!job) {
    const objectManifest = await purgeObjectManifest(env.DB, item);
    const timestamp = now();
    job = {
      id: `purge-${crypto.randomUUID()}`,
      object_manifest: JSON.stringify(objectManifest)
    };
    await env.DB.prepare(`
      INSERT INTO purge_jobs (
        id, trash_item_id, entity_type, entity_id, object_manifest, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)
    `).bind(
      job.id,
      item.id,
      item.entity_type,
      item.entity_id,
      job.object_manifest,
      timestamp,
      timestamp
    ).run();
  }

  const objects = readObjectManifest(job.object_manifest);
  await env.DB.prepare(`
    UPDATE purge_jobs SET status = 'deleting', last_error = NULL, updated_at = ? WHERE id = ?
  `).bind(now(), job.id).run();

  try {
    await Promise.all(objects.map((object) => deleteR2Object(env, object)));
    await finalizePurge(env.DB, item, job.id);
  } catch (error) {
    await env.DB.prepare(`
      UPDATE purge_jobs SET status = 'failed', last_error = ?, updated_at = ? WHERE id = ?
    `).bind(safeErrorMessage(error), now(), job.id).run();
    throw new ArchiveMutationError("purge_failed", "R2 cleanup did not finish. Purge can be retried safely.", 502);
  }
  return { id: item.entity_id };
}

async function purgeObjectManifest(db: Database, item: TrashRow) {
  if (item.entity_type === "photo") return assetsForPhotoIds(db, [item.entity_id]);
  if (item.entity_type !== "album") return [];

  const result = await db.prepare(`
    SELECT ap.photo_id
    FROM album_photos ap
    WHERE ap.album_id = ?
      AND NOT EXISTS (
        SELECT 1 FROM album_photos other
        WHERE other.photo_id = ap.photo_id AND other.album_id != ?
      )
  `).bind(item.entity_id, item.entity_id).all<{ photo_id: string }>();
  return assetsForPhotoIds(db, resultRows<{ photo_id: string }>(result).map((row) => row.photo_id));
}

async function finalizePurge(db: Database, item: TrashRow, jobId: string) {
  const statements = [];
  if (item.entity_type === "album") {
    const orphanResult = await db.prepare(`
      SELECT ap.photo_id
      FROM album_photos ap
      WHERE ap.album_id = ?
        AND NOT EXISTS (
          SELECT 1 FROM album_photos other
          WHERE other.photo_id = ap.photo_id AND other.album_id != ?
        )
    `).bind(item.entity_id, item.entity_id).all<{ photo_id: string }>();
    const orphanIds = resultRows<{ photo_id: string }>(orphanResult).map((row) => row.photo_id);
    statements.push(...orphanIds.flatMap((photoId) => [
      db.prepare("DELETE FROM collection_photos WHERE photo_id = ?").bind(photoId),
      db.prepare("DELETE FROM archive_photos WHERE id = ?").bind(photoId)
    ]));
    statements.push(db.prepare("DELETE FROM archive_albums WHERE id = ?").bind(item.entity_id));
  } else if (item.entity_type === "photo") {
    statements.push(
      db.prepare("DELETE FROM collection_photos WHERE photo_id = ?").bind(item.entity_id),
      db.prepare("DELETE FROM archive_photos WHERE id = ?").bind(item.entity_id)
    );
  } else if (item.entity_type === "set") {
    statements.push(db.prepare("DELETE FROM set_albums WHERE set_id = ?").bind(item.entity_id));
    statements.push(db.prepare("DELETE FROM archive_sets WHERE id = ?").bind(item.entity_id));
  } else if (item.entity_type === "collection") {
    statements.push(db.prepare("DELETE FROM collection_photos WHERE collection_id = ?").bind(item.entity_id));
    statements.push(db.prepare("DELETE FROM archive_collections WHERE id = ?").bind(item.entity_id));
  } else if (item.entity_type === "asset") {
    statements.push(db.prepare("DELETE FROM archive_assets WHERE id = ?").bind(item.entity_id));
  }
  statements.push(
    db.prepare("UPDATE purge_jobs SET status = 'done', updated_at = ? WHERE id = ?").bind(now(), jobId),
    db.prepare("DELETE FROM trash_items WHERE id = ?").bind(item.id)
  );
  await db.batch(statements);
}

async function assetsForPhotoIds(db: Database, photoIds: string[]) {
  if (!photoIds.length) return [];
  const placeholders = photoIds.map(() => "?").join(",");
  const result = await db.prepare(`
    SELECT bucket, object_key FROM archive_assets WHERE photo_id IN (${placeholders})
  `).bind(...photoIds).all<{ bucket: string; object_key: string }>();
  return resultRows<{ bucket: string; object_key: string }>(result)
    .map((row) => ({ bucket: row.bucket, key: row.object_key }));
}

async function deleteR2Object(env: MutationEnv, object: StoredObject) {
  const bucket = object.bucket === "yakov-public-assets"
    ? env.PUBLIC_ASSETS
    : object.bucket === "yakov-private-assets"
      ? env.PRIVATE_ASSETS
      : undefined;
  if (!bucket) throw new Error("Unknown archive bucket.");
  await bucket.delete(object.key);
}

async function readTrashItem(db: Database, itemId: string) {
  const item = await db.prepare(`
    SELECT id, entity_type, entity_id, restore_status, restore_payload
    FROM trash_items WHERE id = ?
  `).bind(itemId).first<TrashRow>();
  if (!item) throw notFound("Bin item");
  return item;
}

function readRestorePayload(value: string | null): RestorePayload {
  if (!value) return {
    restorePhotoStatuses: [] as Array<{ photoId: string; status: ArchiveStatus; hiddenAt?: string }>,
    restoreSetRefs: [] as Array<{
      setId: string;
      albumRef: { albumId: string; position: number; featured: boolean };
    }>
  };
  try {
    return JSON.parse(value) as RestorePayload;
  } catch {
    throw new ArchiveMutationError("restore_payload_invalid", "Restore metadata is invalid.", 409);
  }
}

function readObjectManifest(value: string): StoredObject[] {
  try {
    const parsed = JSON.parse(value) as StoredObject[];
    return Array.isArray(parsed)
      ? parsed.filter((item) => typeof item?.bucket === "string" && typeof item?.key === "string")
      : [];
  } catch {
    throw new ArchiveMutationError("purge_manifest_invalid", "Purge metadata is invalid.", 409);
  }
}

async function normalizeSetPositions(db: Database, setId: string) {
  const result = await db.prepare(`
    SELECT album_id FROM set_albums WHERE set_id = ? ORDER BY position
  `).bind(setId).all<{ album_id: string }>();
  const rows = resultRows<{ album_id: string }>(result);
  if (!rows.length) return;
  await db.batch(rows.map((row, index) =>
    db.prepare("UPDATE set_albums SET position = ?, featured = ? WHERE set_id = ? AND album_id = ?")
      .bind(index, index === 0 ? 1 : 0, setId, row.album_id)
  ));
}

async function normalizeAlbumPositions(db: Database, albumId: string) {
  const result = await db.prepare(`
    SELECT photo_id FROM album_photos WHERE album_id = ? ORDER BY position
  `).bind(albumId).all<{ photo_id: string }>();
  const rows = resultRows<{ photo_id: string }>(result);
  if (!rows.length) return;
  await db.batch(rows.map((row, index) =>
    db.prepare("UPDATE album_photos SET position = ? WHERE album_id = ? AND photo_id = ?")
      .bind(index + 1, albumId, row.photo_id)
  ));
}

async function repairAlbumCovers(db: Database, albumId: string, removedPhotoId: string) {
  const [album, removedAssets, fallback] = await Promise.all([
    db.prepare(`
      SELECT cover_landscape_asset_id, cover_portrait_asset_id, cover_square_asset_id
      FROM archive_albums WHERE id = ?
    `).bind(albumId).first<{
      cover_landscape_asset_id: string | null;
      cover_portrait_asset_id: string | null;
      cover_square_asset_id: string | null;
    }>(),
    db.prepare("SELECT id FROM archive_assets WHERE photo_id = ?")
      .bind(removedPhotoId)
      .all<{ id: string }>(),
    db.prepare(`
      SELECT
        MAX(CASE WHEN aa.version = 'display' THEN aa.id END) AS display_id,
        MAX(CASE WHEN aa.version = 'thumb' THEN aa.id END) AS thumb_id
      FROM album_photos ap
      JOIN archive_assets aa ON aa.photo_id = ap.photo_id AND aa.access = 'public'
      WHERE ap.album_id = ?
      GROUP BY ap.photo_id, ap.position
      ORDER BY ap.position
      LIMIT 1
    `).bind(albumId).first<{ display_id: string | null; thumb_id: string | null }>()
  ]);
  if (!album) return;

  const removedIds = new Set(resultRows<{ id: string }>(removedAssets).map((asset) => asset.id));
  const displayId = fallback?.display_id ?? fallback?.thumb_id ?? null;
  const thumbId = fallback?.thumb_id ?? fallback?.display_id ?? null;
  const landscape = album.cover_landscape_asset_id && removedIds.has(album.cover_landscape_asset_id)
    ? displayId
    : album.cover_landscape_asset_id;
  const portrait = album.cover_portrait_asset_id && removedIds.has(album.cover_portrait_asset_id)
    ? displayId
    : album.cover_portrait_asset_id;
  const square = album.cover_square_asset_id && removedIds.has(album.cover_square_asset_id)
    ? thumbId
    : album.cover_square_asset_id;

  await db.prepare(`
    UPDATE archive_albums
    SET cover_landscape_asset_id = ?, cover_portrait_asset_id = ?,
        cover_square_asset_id = ?, updated_at = ?
    WHERE id = ?
  `).bind(landscape, portrait, square, now(), albumId).run();
}

async function assetSummary(db: Database, photoIds: string[]) {
  if (!photoIds.length) return { bytes: 0, fileCount: 0 };
  const placeholders = photoIds.map(() => "?").join(",");
  const row = await db.prepare(`
    SELECT COUNT(*) AS file_count, COALESCE(SUM(bytes), 0) AS bytes
    FROM archive_assets WHERE photo_id IN (${placeholders})
  `).bind(...photoIds).first<{ file_count: number; bytes: number }>();
  return { bytes: row?.bytes ?? 0, fileCount: row?.file_count ?? 0 };
}

async function readSettings(db: Database) {
  const row = await db.prepare("SELECT value FROM admin_settings WHERE key = 'archive'")
    .first<{ value: string }>();
  if (!row) return defaultAdminSettings;
  try {
    return adminSettingsSchema.parse(JSON.parse(row.value));
  } catch {
    return defaultAdminSettings;
  }
}

async function assertIdsExist(
  db: Database,
  table: "archive_albums" | "archive_tags",
  ids: string[]
) {
  if (!ids.length) return;
  const placeholders = ids.map(() => "?").join(",");
  const result = await db.prepare(`SELECT id FROM ${table} WHERE id IN (${placeholders})`)
    .bind(...ids)
    .all<{ id: string }>();
  if ((result.results ?? []).length !== new Set(ids).size) throw notFound(table === "archive_tags" ? "tag" : "album");
}

async function nextSortOrder(db: Database, table: "archive_sets") {
  const row = await db.prepare(`SELECT COALESCE(MAX(sort_order), -1) + 1 AS value FROM ${table}`)
    .first<{ value: number }>();
  return row?.value ?? 0;
}

async function nextPosition(
  db: Database,
  table: "album_photos" | "set_albums",
  parentColumn: "album_id" | "set_id",
  parentId: string,
  first = 1
) {
  const row = await db.prepare(`
    SELECT COALESCE(MAX(position), ?) + 1 AS value FROM ${table} WHERE ${parentColumn} = ?
  `).bind(first - 1, parentId).first<{ value: number }>();
  return row?.value ?? first;
}

async function uniqueSlug(
  db: Database,
  table: "archive_sets" | "archive_tags",
  title: string
) {
  const base = slugify(title) || "untitled";
  const result = await db.prepare(`SELECT slug FROM ${table} WHERE slug = ? OR slug LIKE ?`)
    .bind(base, `${base}-%`)
    .all<{ slug: string }>();
  const existing = new Set(resultRows<{ slug: string }>(result).map((row) => row.slug));
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

function resultRows<T>(result: { results?: unknown[] }): T[] {
  return (result.results ?? []) as T[];
}

function purgeAfter(timestamp: string, days: number) {
  return new Date(new Date(timestamp).getTime() + days * 86_400_000).toISOString();
}

function now() {
  return new Date().toISOString();
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function safeErrorMessage(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 500) : "Unknown purge error";
}

function notFound(entity: string) {
  return new ArchiveMutationError("not_found", `${entity} was not found.`, 404);
}

export class ArchiveMutationError extends Error {
  constructor(readonly code: string, message: string, readonly status: number) {
    super(message);
  }
}
