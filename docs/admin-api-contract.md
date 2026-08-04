# Admin API Contract

## Runtime

The admin is a Cloudflare-backed application. D1 is the metadata source of truth and R2
stores image objects. There is no runtime `localStorage` or IndexedDB archive adapter.

All `/admin*` pages and `/api/admin/*` endpoints require a valid Cloudflare Access JWT
for exactly `Jacobjshmol@gmail.com`. Local preview bypass is accepted only when all
three conditions are true:

```txt
ADMIN_ACCESS_ENABLED != true
ADMIN_RUNTIME_ENV=local
ADMIN_LOCAL_BYPASS=true
```

OpenNext rewrites the Host header in local preview, so the bypass cannot rely on Host.
The two local-only variables live only in ignored `.dev.vars` and are absent from the
production Worker; production additionally has `ADMIN_ACCESS_ENABLED=true`.

## Read And Upload Endpoints

```txt
GET  /api/admin/archive
GET  /api/admin/albums
GET  /api/admin/logjam
GET  /api/admin/logjam/submissions/:submissionId
POST /api/admin/albums
POST /api/admin/albums/:albumId/photos
GET  /api/admin/assets/:assetId
POST /api/admin/mutations
POST /api/admin/logjam/mutations
```

`GET /api/admin/archive` returns the normalized Set, Album, AlbumPhoto, Photo, Asset,
Tag, Settings, Bin, and UploadJob state used by every admin screen.

`POST /api/admin/albums` accepts:

```json
{
  "title": "Film 073",
  "subtitle": "Bangkok, 2025",
  "status": "draft",
  "publicDownloadPolicy": "none"
}
```

`POST /api/admin/albums/:albumId/photos` accepts multipart fields:

```txt
clientUploadId       UUID v4 for idempotent retry
file                 sanitized expanded JPEG, max 20 MiB
width / height       expanded dimensions
expandedColorProfile preserve or srgb
thumb                JPEG, max 512 KiB
thumbWidth / Height
display              JPEG, max 2 MiB
displayWidth / Height
title                optional
```

The Worker writes real `thumb`, `display`, and `expanded` objects to
`yakov-public-assets`. It creates one canonical Photo, one AlbumPhoto membership, three
Asset rows, and one UploadJob. Retrying a completed `clientUploadId` returns the
existing result.

`GET /api/admin/assets/:assetId` is an owner-protected inspector stream. It resolves the
bucket from D1 and never accepts an arbitrary object key from the client.

## LogJam Owner Endpoints

`GET /api/admin/logjam` returns the compact owner overview:

```txt
users[]
  id, email, displayName, createdAt, lastSeenAt

curations[]
  id, userId, title, status, locked, revision, photoCount, createdAt, updatedAt
  submissions[]
    id, version, sourceRevision, title, status, photoCount, submittedAt, archivedAt
    promotedAlbumId, promotedAlbumStatus, promotedAt
```

`status` is `active | archived` for a working curation and `submitted | archived` for
an immutable submission. `locked=true` means a promoted canonical album has been
published at least once, so the curator can no longer mutate that working curation even
if the album is later unpublished.

The overview intentionally omits the photo arrays. Opening a submitted version lazily
calls `GET /api/admin/logjam/submissions/:submissionId`, which returns:

```txt
submission
  overview fields + curationId, userId, userEmail, userDisplayName

photos[] in immutable submission order
  id, position, title, thumbUrl, displayUrl, width, height, available, published
```

Photo metadata and URLs are nullable when a canonical photo is missing. The admin must
show those gaps and block promotion until every submitted photo is available; it must
not silently drop or reorder missing rows.

`POST /api/admin/logjam/mutations` accepts exactly three owner actions:

```json
{ "action": "rename-user", "userId": "user-id", "displayName": "Curator name" }
{ "action": "rename-user", "userId": "user-id", "displayName": null }
{ "action": "archive-submission", "submissionId": "submission-id" }
{ "action": "promote-submission", "submissionId": "submission-id", "title": "Optional override" }
```

Rename returns `{ userId, displayName }`. Archive returns
`{ submissionId, status, archivedAt }`. Promotion returns
`{ submissionId, albumId, albumSlug, albumStatus, created }`; a retry returns the same
canonical album with `created=false`. Promotion creates a canonical Album and ordered
AlbumPhoto memberships without copying any Photo or R2 Asset.

## Mutation Endpoint

`POST /api/admin/mutations` validates a discriminated action union. Implemented actions:

```txt
albums    update, reorder/move, reverse order, covers, Bin
photos    update, reorder, hide/publish, direct tags, Bin
links     add/remove an existing photo from an album
sets      create, update, reorder, add/remove/reorder albums, Bin
tags      create, edit, attach/detach, delete when unused
settings  update active defaults
bin       restore with prior status, permanent purge
```

Purging removes unshared R2 objects and D1 records. Removing one AlbumPhoto membership
does not delete the canonical photo or any assets. The final membership cannot be
removed accidentally; the photo must go through Bin.

## Public Contract

Public pages read D1 directly on the server and return only published records and
public assets:

```txt
/                         albums in published Sets, ordered by Set and membership
/albums                   all published albums
/albums/:slug             published photos in album order
/tags/:slug               published albums containing that album/effective photo tag
/api/public/.../download  expanded JPEG only when policy allows it
```

No public response contains R2 credentials, private object keys, GPS, EXIF, XMP, IPTC,
RAW, TIFF, or Google Drive links.

## Error And Consistency Rules

- API responses use `{ ok, data }` or `{ ok: false, error }`;
- all JSON and mutation bodies are Zod-validated;
- writes fail closed when Access configuration is missing or invalid;
- public mutation success revalidates the public route tree;
- Bin restore preserves the previous entity status;
- D1 foreign keys must remain clean after migration, restore, and purge.
