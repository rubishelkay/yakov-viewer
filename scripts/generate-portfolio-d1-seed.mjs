import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = resolve(projectRoot, "src/content/portfolio-manifest.json");
const outputPath = resolve(process.argv[2] ?? "/tmp/yakov-portfolio-seed.sql");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const importedAt = "2026-07-17T00:00:00.000Z";
const assetBaseUrl = "https://assets.yakov.shmol.cc";
const setId = "set-portfolio-index";
const lines = [
  "-- Generated from src/content/portfolio-manifest.json.",
  "-- Idempotent seed: media bytes are uploaded separately to R2.",
  "PRAGMA defer_foreign_keys = true;"
];

const tags = new Map();
for (const album of manifest.albums ?? []) {
  for (const label of albumLabels(album)) {
    const slug = slugify(label);
    tags.set(`tag-${slug}`, { id: `tag-${slug}`, slug, label });
  }
}

for (const tag of tags.values()) {
  lines.push(
    insertIgnore(
      "archive_tags",
      ["id", "slug", "label", "scope", "created_at"],
      [tag.id, tag.slug, tag.label, "both", importedAt]
    )
  );
}

lines.push(
  insertIgnore(
    "archive_sets",
    [
      "id",
      "slug",
      "title",
      "subtitle",
      "description",
      "status",
      "sort_order",
      "layout_mode",
      "created_at",
      "updated_at",
      "published_at"
    ],
    [
      setId,
      "portfolio-index",
      "Yakov Shmol",
      "Film and digital archive",
      "The first public set imported from the accepted Fable frontend.",
      "published",
      0,
      "fullscreen-carousel",
      importedAt,
      importedAt,
      importedAt
    ]
  )
);

for (const album of manifest.albums ?? []) {
  const albumId = `album-${album.id}`;
  const coverImage =
    album.images.find((image) => image.srcKey === stripLeadingSlash(album.coverImage)) ??
    album.images[0];
  const displayCoverId = assetId(coverImage.id, "display");
  const thumbCoverId = assetId(coverImage.id, "thumb");

  lines.push(
    insertIgnore(
      "archive_albums",
      [
        "id",
        "slug",
        "title",
        "subtitle",
        "description",
        "status",
        "is_demo",
        "public_download_policy",
        "cover_landscape_asset_id",
        "cover_portrait_asset_id",
        "cover_square_asset_id",
        "sort_order",
        "date_start",
        "date_end",
        "location_text",
        "film_stock",
        "created_at",
        "updated_at",
        "published_at"
      ],
      [
        albumId,
        album.slug,
        album.title,
        album.subtitle ?? "",
        "",
        "published",
        0,
        "none",
        displayCoverId,
        displayCoverId,
        thumbCoverId,
        album.order,
        album.year ? `${album.year}-01-01` : null,
        album.year ? `${album.year}-12-31` : null,
        album.location || null,
        album.filmStock || null,
        importedAt,
        importedAt,
        importedAt
      ]
    )
  );

  lines.push(
    insertReplace(
      "set_albums",
      ["set_id", "album_id", "position", "featured"],
      [setId, albumId, album.order, album.order === 0 ? 1 : 0]
    )
  );

  for (const label of albumLabels(album)) {
    lines.push(
      insertIgnore(
        "album_tags",
        ["album_id", "tag_id"],
        [albumId, `tag-${slugify(label)}`]
      )
    );
  }

  for (const image of album.images ?? []) {
    const photoId = `photo-${image.id}`;

    lines.push(
      insertIgnore(
        "archive_photos",
        [
          "id",
          "slug",
          "title",
          "description",
          "status",
          "frame_number",
          "width",
          "height",
          "dominant_color",
          "created_at",
          "updated_at",
          "published_at"
        ],
        [
          photoId,
          image.id,
          image.alt,
          "",
          "published",
          image.position,
          image.width,
          image.height,
          "#111111",
          importedAt,
          importedAt,
          importedAt
        ]
      )
    );

    lines.push(
      insertReplace(
        "album_photos",
        ["album_id", "photo_id", "position", "created_at"],
        [albumId, photoId, image.position, importedAt]
      )
    );

    lines.push(
      assetInsert({
        id: assetId(image.id, "thumb"),
        photoId,
        version: "thumb",
        key: image.thumbKey,
        publicUrl: `${assetBaseUrl}/${stripLeadingSlash(image.thumbKey)}`,
        width: null,
        height: null,
        bytes: image.thumbBytes
      }),
      assetInsert({
        id: assetId(image.id, "display"),
        photoId,
        version: "display",
        key: image.srcKey,
        publicUrl: `${assetBaseUrl}/${stripLeadingSlash(image.srcKey)}`,
        width: image.width,
        height: image.height,
        bytes: image.srcBytes
      })
    );
  }
}

const settings = {
  defaultAlbumStatus: "draft",
  defaultPhotoStatus: "review",
  expandedTargetMb: 2.5,
  publicDownloadMode: "downloadJpeg",
  downloadJpegTargetMb: 3.8,
  sourceJpegPublicAllowed: false,
  trashRetentionDays: 7,
  derivativeColorProfile: "srgb",
  sourceJpegPolicy: "preserve",
  publicExifPolicy: "strip-sensitive"
};

lines.push(
  insertReplace(
    "admin_settings",
    ["key", "value", "updated_at"],
    ["archive", JSON.stringify(settings), importedAt]
  ),
  "PRAGMA foreign_key_check;",
  ""
);

await writeFile(outputPath, lines.join("\n"), "utf8");

const photoCount = (manifest.albums ?? []).reduce(
  (sum, album) => sum + (album.images?.length ?? 0),
  0
);
console.log(
  `Generated ${outputPath}: ${manifest.albums.length} albums, ${photoCount} photos, ` +
    `${photoCount * 2} real asset records.`
);

function assetInsert({ id, photoId, version, key, publicUrl, width, height, bytes }) {
  return insertIgnore(
    "archive_assets",
    [
      "id",
      "photo_id",
      "version",
      "access",
      "bucket",
      "object_key",
      "public_url",
      "width",
      "height",
      "bytes",
      "mime_type",
      "color_profile",
      "created_at"
    ],
    [
      id,
      photoId,
      version,
      "public",
      "yakov-public-assets",
      stripLeadingSlash(key),
      publicUrl,
      width,
      height,
      bytes,
      "image/jpeg",
      "srgb",
      importedAt
    ]
  );
}

function insertIgnore(table, columns, values) {
  return `INSERT OR IGNORE INTO ${table} (${columns.join(", ")}) VALUES (${values
    .map(sqlValue)
    .join(", ")});`;
}

function insertReplace(table, columns, values) {
  return `INSERT OR REPLACE INTO ${table} (${columns.join(", ")}) VALUES (${values
    .map(sqlValue)
    .join(", ")});`;
}

function sqlValue(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return String(value);
  return `'${String(value).replaceAll("'", "''")}'`;
}

function albumLabels(album) {
  return Array.from(
    new Set(
      [album.type, album.year, album.location, album.filmStock, ...(album.tags ?? [])]
        .map((value) => String(value ?? "").trim())
        .filter(Boolean)
    )
  );
}

function assetId(sourceId, version) {
  return `asset-${sourceId}-${version}`;
}

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function stripLeadingSlash(value) {
  return String(value).replace(/^\/+/, "");
}
