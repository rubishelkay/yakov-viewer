# Admin API Contract

## Purpose

The first admin UI uses local mock data. The next milestone replaces that mock repository with Cloudflare Pages Functions backed by D1, R2, and Queues.

This file records the first API shape so the UI, D1 schema, and Cloudflare bindings move in the same direction.

## Admin Endpoints

```txt
GET  /api/admin/archive
GET  /api/admin/sets
GET  /api/admin/albums
GET  /api/admin/tags
POST /api/admin/albums
PATCH /api/admin/sets/:id
POST /api/admin/uploads/sign
```

First implemented stubs:

- `functions/api/admin/archive.js`
- `functions/api/admin/sets.js`
- `functions/api/admin/sets/[id].js`
- `functions/api/admin/albums.js`
- `functions/api/admin/tags.js`
- `functions/api/admin/uploads/sign.js`

`/api/admin/uploads/sign` intentionally returns `501 not_wired` until D1/R2 bindings exist. It validates the intended JPEG-only request shape so frontend work can continue safely.

## Public Endpoints

```txt
GET /api/public/sets
GET /api/public/albums
GET /api/public/photos
```

First implemented stub:

- `functions/api/public/sets.js`

Public endpoints must only return published records and public asset URLs. They must never return private R2 keys, `sourceJpeg`, RAW/RAF/TIFF, or sensitive EXIF.

## Request Defaults

Upload signing request:

```json
{
  "albumId": "album-film-073",
  "files": [
    {
      "fileName": "000035300041.jpg",
      "bytes": 12800000,
      "mimeType": "image/jpeg",
      "position": 0
    }
  ]
}
```

Rules:

- first upload milestone accepts JPEG only;
- source JPEG goes to private R2;
- derivatives go to public R2;
- album/photo records start as draft/review;
- upload order becomes initial photo position;
- image processing job creates `thumb`, `display`, `expanded`, and `downloadJpeg`.

## Secrets

Do not commit tokens or keys. Use Cloudflare bindings and secrets:

```txt
DB
PUBLIC_ASSETS
PRIVATE_ASSETS
IMAGE_PROCESSING
```

Cloudflare Access should protect `/admin` before production use.
