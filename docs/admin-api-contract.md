# Admin API Contract

## Purpose

The first admin UI uses local data. The next milestone adds OpenNext Route Handlers backed by D1 and R2; Queues remain optional until derivative processing needs them.

This file records the first API shape so the UI, D1 schema, and Cloudflare bindings move in the same direction.

## Implemented Admin Endpoints

```txt
GET  /api/admin/archive
GET  /api/admin/albums
POST /api/admin/albums
POST /api/admin/albums/:albumId/photos
GET  /api/admin/assets/:assetId
```

These are typed Next.js Route Handlers using Worker bindings. The first upload path is
direct multipart through the protected Worker. A signed/direct-to-R2 flow is a future
optimization, not part of the first working contract.

`GET /api/admin/archive` returns the complete normalized archive for the admin.

`POST /api/admin/albums` accepts JSON:

```json
{
  "title": "Film 073",
  "subtitle": "Bangkok, 2025"
}
```

`POST /api/admin/albums/:albumId/photos` accepts `multipart/form-data` fields:

```txt
clientUploadId  UUID v4 retained for idempotent retry
sourceFileName  original selected filename
sourceBytes     original selected byte size, maximum 20 MiB
retainSource    `true` only when the private source should be retained
file            optional source JPEG; required only when retainSource=true
width/height    positive source dimensions
thumb           generated JPEG, maximum 512 KiB
thumbWidth/Height
display         generated JPEG, maximum 2 MiB
displayWidth/Height
title           optional
```

The Worker checks MIME type and JPEG magic bytes for every uploaded file. It always
writes real `thumb`/`display` files to public R2. When `retainSource=true`, it additionally
writes the unchanged source to private R2. It then creates canonical `Photo`,
`AlbumPhoto`, two or three `Asset` rows, and one `UploadJob`. If an R2 or D1 step fails,
newly written R2 objects are deleted. Repeating a completed request with the same
`clientUploadId` returns the existing result without adding another photo.

`GET /api/admin/assets/:assetId` streams an asset through the protected Worker. Private
assets are returned with `Cache-Control: private, no-store`.

## Planned Mutation Endpoints

```txt
PATCH  /api/admin/albums/:albumId
PATCH  /api/admin/photos/:photoId
POST   /api/admin/photos/:photoId/albums
DELETE /api/admin/photos/:photoId/albums/:albumId
POST   /api/admin/sets
PATCH  /api/admin/sets/:setId
POST   /api/admin/tags
PATCH  /api/admin/settings
POST   /api/admin/bin/:itemId/restore
DELETE /api/admin/bin/:itemId
```

The visible admin remains on the local repository until the essential mutation set is
implemented. Activating a partial adapter would make some controls persistent and
others browser-only, which is deliberately avoided.

Implemented infrastructure endpoint:

```txt
GET /api/health
```

It reports only whether expected bindings are present and never returns IDs, values, keys, or secrets.

## Shared Archive Shape

```txt
Photo       -> canonical metadata and Asset ownership
AlbumPhoto  -> albumId, photoId, album-specific position
Album       -> publication, tags, covers, set membership
```

Adding an existing photo to another album creates only an `AlbumPhoto` row. Hiding or deleting a canonical photo affects every album appearance. Purging an album deletes media only for photos that have no remaining album memberships.

## Public Endpoints

```txt
GET /api/public/sets
GET /api/public/albums
GET /api/public/photos
```

Public endpoints must only return published records and public asset URLs. They must never return private R2 keys, `sourceJpeg`, RAW/RAF/TIFF, or sensitive EXIF.

Rules:

- first upload milestone accepts JPEG only;
- source JPEG retention is optional and off by default to stay inside the R2 free tier;
- `thumb` and `display` are generated in the browser before upload and are recorded only
  after real R2 objects exist;
- album/photo records start as draft/review;
- upload order becomes initial photo position;
- later processing may move server-side and add optional `expanded` and `downloadJpeg`.

## Access

On localhost, the API permits requests so the full flow can be tested with local D1
and R2. OpenNext Worker preview uses `ADMIN_LOCAL_BYPASS=true` from ignored `.dev.vars`
because OpenNext normalizes its internal origin to the production URL. On any external
deployment that bypass variable is absent, and every admin endpoint requires the
`Cf-Access-Authenticated-User-Email` header to match the configured `ADMIN_EMAIL`.
Missing Access configuration fails closed. Production `workers.dev` and version preview
URLs are disabled so the protected custom hostname is the only external route to these
handlers.

## Secrets

Do not commit tokens or keys. Use Cloudflare bindings and secrets:

```txt
DB
PUBLIC_ASSETS
PRIVATE_ASSETS
IMAGE_PROCESSING
```

Cloudflare Access should protect `/admin` before production use.
