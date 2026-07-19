# Cloudflare Setup

## Target Deployment

The combined public site, `/admin`, and API should run as one Next.js application on Cloudflare Workers through `@opennextjs/cloudflare`.

```txt
yakov.shmol.cc          -> Next.js/OpenNext Worker
yakov.shmol.cc/admin    -> same Worker, protected by Cloudflare Access
assets.yakov.shmol.cc   -> public R2 derivatives
```

Cloudflare now recommends Workers for full-stack Next.js applications. Static Pages export is no longer the target architecture because newly published album routes must work without rebuilding the site.

Official references:

- https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/
- https://opennext.js.org/cloudflare/bindings
- https://developers.cloudflare.com/workers/ci-cd/builds/

## GitHub Deployment

Source deployment should remain Git-based:

```txt
GitHub repository
  -> Cloudflare Workers Builds
  -> preview deployment for the integration branch
  -> production deployment from the agreed production branch
```

No production switch should happen before the preview has passed public-site, admin, upload, and security checks. The existing production site has no content that needs to be preserved, but replacing it is still an externally visible action and requires a short pre-action brief.

## Bindings

Production Worker bindings:

```txt
DB                         -> D1 yakov_archive
PUBLIC_ASSETS              -> R2 yakov-public-assets
PRIVATE_ASSETS             -> R2 yakov-private-assets
NEXT_INC_CACHE_R2_BUCKET   -> R2 yakov-next-cache
IMAGE_QUEUE                -> optional later derivative queue
```

Bindings are capabilities provided by Cloudflare. They do not require R2 access keys or D1 credentials in application source.

## Repository Configuration

The repository now contains the manually reviewed equivalent of the OpenNext migration:

```txt
open-next.config.ts   -> OpenNext adapter configuration
wrangler.jsonc        -> Worker, local D1/R2 bindings, public vars
cloudflare-env.d.ts   -> compact generated binding types
```

`wrangler.jsonc` contains the real production D1 UUID and the three production R2
bindings. Treat `pnpm deploy` as a production command. Local D1 still uses Wrangler's
isolated `.wrangler/state` database when `--local` is passed.

Local commands:

```sh
pnpm cf-typegen
pnpm d1:migrate:local
pnpm exec opennextjs-cloudflare build
pnpm exec opennextjs-cloudflare preview
```

Before the first local Worker preview, create ignored `.dev.vars` from the safe
`.dev.vars.example` template. `ADMIN_LOCAL_BYPASS` is strictly a local preview switch;
do not add it to Worker production variables.

The external admin remains disabled with `ADMIN_ACCESS_ENABLED=false` until Cloudflare
Access is configured and tested.

## R2 Layout

Recommended bucket split:

```txt
yakov-public-assets
yakov-private-assets
yakov-next-cache
```

Public bucket content:

```txt
photos/<album path>/<file>.jpg          display tier
photos/thumbs/<album path>/<file>.jpg   thumbnail tier
```

Private bucket content:

```txt
source-jpeg/
master/
staging/
bin/
```

The initial import contains 624 public JPEG objects for 9 accepted albums and 312
photos: one thumbnail and one display file per photo. Sampled objects were downloaded
from R2 after upload and matched the local SHA-256 hashes. No image bytes are stored in
Git.

`yakov-next-cache` is infrastructure storage for OpenNext prerender entries. It must not
be used for portfolio media.

## D1

D1 stores metadata and relationships only:

- sets and set-album ordering;
- albums;
- canonical photos;
- album-photo membership and ordering;
- asset records and R2 keys;
- tags;
- statuses and publication state;
- upload jobs and bin records.

The migration stores canonical photos independently and keeps album-specific `position` in `album_photos`.

Local and production verification completed on 2026-07-18:

- `0001_archive.sql` applied successfully with 23 commands;
- `archive_albums`, `archive_photos`, `album_photos`, and `archive_assets` exist;
- `PRAGMA foreign_key_check` returned no violations.
- the optional source-retention path was verified by uploading a JPEG through the local
  OpenNext Worker into private R2;
- the matching Photo, AlbumPhoto, Asset, and UploadJob rows were written to D1;
- the protected asset endpoint returned byte-identical JPEG data;
- the same archive route works in both `opennextjs-cloudflare preview` and `pnpm dev`.
- production D1 contains 9 albums, 312 photos, 312 album memberships, 624 real asset
  records, 1 set, and 11 tags;
- production `PRAGMA foreign_key_check` returned no violations;
- the seed is idempotent and contains only the real `thumb` and `display` assets.

## Admin Access

Protect both the parent paths and their descendants with Cloudflare Access:

```txt
yakov.shmol.cc/admin
yakov.shmol.cc/admin/*
yakov.shmol.cc/api/admin
yakov.shmol.cc/api/admin/*
```

Use Google as the identity provider and allow exactly this owner email:

```txt
Jacobjshmol@gmail.com
```

Application-level login is not required for the first upload milestone.

The Google OAuth client secret belongs in Cloudflare Zero Trust / Google Cloud only. It
must never be entered into source files, Wrangler variables, `.env.example`, or GitHub.

The application API verifies Cloudflare Access on non-local hosts. The expected
email is configured as the non-secret `ADMIN_EMAIL` Worker variable; requests without a
matching Access identity fail closed.

Until the Access application exists, `ADMIN_ACCESS_ENABLED=false` makes external
`/admin` return 404 and `/api/admin/*` return 503. Localhost remains available for
development. Local OpenNext Worker preview additionally reads
`ADMIN_LOCAL_BYPASS=true` from ignored `.dev.vars`; that flag must never be set in the
production Worker.

`workers_dev` and Worker version preview URLs are disabled in production configuration.
This prevents an alternate hostname from reaching admin routes outside the Access
application. Local development remains available only through the explicit ignored
`ADMIN_LOCAL_BYPASS=true` switch.

## Free-plan envelope

The initial production configuration targets Cloudflare Free:

- R2 Standard: 10 GB-month, 1 million Class A operations and 10 million Class B
  operations per month included;
- Workers Free: 100,000 requests per day;
- D1 Free: 5 million rows read and 100,000 rows written per day;
- Cloudflare Access: owner-only use is comfortably below the free plan's 50-user limit.

The uploader stores `thumb + display` by default. A private `sourceJpeg` is retained only
when the owner explicitly enables it for that batch. Do not use R2 Infrequent Access for
this first version because its storage has no free tier.

## Remote Change Policy

Cloudflare resources and deployments should be inspected and changed through Wrangler
or the Cloudflare API. Browser automation is not the default path.

Before any remote create, migration, upload, binding change, domain switch, or deploy:

1. provide a short pre-action brief with exact resource names and environment;
2. confirm ambiguous names or destructive effects with the owner;
3. run the command through Wrangler/API;
4. report the result without exposing tokens or secrets.

The current production resources were created and populated through Wrangler/API after
explicit owner approval. The older unrelated R2 buckets `cards`, `mbst1`, and `yakov`
were not touched.

## Secrets

Never commit:

- `.env` or `.dev.vars`;
- Cloudflare API tokens;
- R2 access keys;
- account IDs when they are not required as non-secret deployment config;
- private media URLs or signed URLs;
- uploaded JPEGs, RAW, TIFF, thumbnails, or generated derivatives.

Repository-safe files include binding names, schema/migrations, Worker configuration without secrets, and `.env.example` placeholders.

## Current Audit Status

As of 2026-07-19:

- Next.js 16.2.6 builds successfully with `@opennextjs/cloudflare` 1.20.1;
- the generated Worker serves `/`, real album routes, and `/api/health` on
  `yakov-viewer.jacobjshmol.workers.dev`;
- local D1 and both local R2 bindings are visible to the Worker;
- the ordered multipart JPEG path has passed a local D1/R2 round-trip test with real
  browser-generated `thumb`/`display`, optional unchanged private source, and
  idempotent retry;
- the R2 custom domain `assets.yakov.shmol.cc` is active with TLS 1.2 minimum;
- clean-browser production QA loaded the 9 real album covers and all 36 photos in the
  checked album with zero failed images or console errors;
- external `/admin` is hidden and the admin API is disabled until Access is ready;
- production migration `0003_upload_job_photo.sql` has not yet been applied;
- `yakov.shmol.cc/*` is live on the OpenNext Worker through a zone Worker Route;
- the old Pages custom-domain attachment is removed, but the Pages project remains
  available for rollback;
- GitHub Workers Builds and Cloudflare Access are not configured yet.
