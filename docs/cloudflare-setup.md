# Cloudflare Setup

## Production Topology

```txt
yakov.shmol.cc          -> Next.js/OpenNext Worker yakov-viewer
yakov.shmol.cc/admin    -> same Worker behind Cloudflare Access
assets.yakov.shmol.cc   -> public R2 bucket custom domain

D1  yakov_archive
R2  yakov-public-assets
R2  yakov-private-assets
R2  yakov-next-cache
```

The public hostname uses a Worker Route for `yakov.shmol.cc/*`. `workers.dev` and
version preview URLs are disabled. The old Pages project is not the runtime target.

## Repository Configuration

```txt
open-next.config.ts
custom-worker.ts
wrangler.jsonc
cloudflare-env.d.ts
migrations/
```

`wrangler.jsonc` contains binding names, the D1 UUID, non-secret Access identifiers,
owner email, and public hostnames. R2/D1 credentials are injected as bindings and do
not belong in source.

Local setup uses ignored `.dev.vars` copied from `.dev.vars.example`:

```txt
ADMIN_ACCESS_ENABLED=false
ADMIN_RUNTIME_ENV=local
ADMIN_LOCAL_BYPASS=true
```

OpenNext rewrites Host during local preview, so the bypass intentionally depends on
the two ignored local-only variables rather than Host. Neither variable is configured
on the production Worker, where `ADMIN_ACCESS_ENABLED=true` also disables bypass.

## Access

Cloudflare Access application `Yakov Viewer Admin` protects:

```txt
/admin
/admin/*
/api/admin
/api/admin/*
```

The reusable owner policy allows exactly:

```txt
Jacobjshmol@gmail.com
```

The Worker independently validates JWT signature, issuer, audience, expiry, and exact
email. Missing or invalid configuration fails closed. Access variables are:

```txt
ACCESS_APP_AUD
ACCESS_TEAM_DOMAIN
ADMIN_ACCESS_ENABLED=true
ADMIN_EMAIL=Jacobjshmol@gmail.com
```

## Storage

`yakov-public-assets` currently stores:

```txt
thumb
display
expanded
```

All three are public web JPEG tiers. The expanded file is the sanitized uploaded
3-5 MB JPEG and may be as large as 20 MiB. It is used for zoom and optionally Download.

`yakov-private-assets` remains reserved for later Google Drive master/staging
integration. Current uploads do not duplicate expanded into private R2.

`yakov-next-cache` belongs only to OpenNext incremental cache.

## Worker CPU And Public Cache

The Workers Free CPU limit is tight enough that a cold dynamic Next render can
occasionally fail with Cloudflare `1102`. `custom-worker.ts` therefore acts as an
uncached gateway:

```txt
public GET document -> cached PublicFrontend entrypoint -> OpenNext/D1
admin, API, assets, RSC, mutations -> uncached OpenNext entrypoint
```

Public HTML is fresh for 60 seconds and may be served stale while Cloudflare refreshes
it or while a transient Worker error is active. Browser cache headers remain controlled
by Next; the edge policy is supplied only to Cloudflare Workers Caching. Public links
use document navigation so normal browsing can benefit from that cache without emitting
Next prefetch requests. A new Worker version starts with an empty cache and should be
prewarmed after deployment.

The admin archive endpoint still returns one complete snapshot. Production skips a
second server-side Zod walk, but pagination or entity-specific reads are required before
the archive grows substantially beyond the first real albums.

## D1 Migrations

```txt
0001_archive.sql             core archive
0002_album_photo_order.sql   forward/reverse album display
0003_upload_job_photo.sql    upload idempotency link
0004_cloud_admin.sql         cover priority, status-aware restore, purge jobs
0005_public_web_tiers.sql    current defaults and 7-day Bin
```

Apply locally:

```sh
pnpm d1:migrate:local
```

Apply remotely only after the short external-action brief:

```sh
pnpm exec wrangler d1 migrations apply yakov_archive --remote
```

Always run `PRAGMA foreign_key_check` after remote migrations and destructive Bin QA.

## Build And Preview

```sh
pnpm check
pnpm preview
```

Production:

```sh
pnpm run deploy
```

`pnpm run deploy` builds and deploys the production Worker and is therefore an externally
visible action.

## Free-Plan Envelope

The initial project aims to remain close to the Cloudflare free allowances. The user
expects roughly 20-50 albums first and accepts normal R2 billing if storage exceeds the
included 10 GB-month. The admin should report storage, but must not silently lower
quality or delete files to fit a quota.

The approximate per-photo storage is:

```txt
expanded input + display ~1 MB + thumb <=300 KB
```

## Remote Change Policy

Use Wrangler or Cloudflare API, not browser automation, for migration and deploy.
Before every remote migration, resource mutation, domain switch, upload, or deploy:

1. state exact resource and effect;
2. confirm ambiguous or destructive details;
3. execute through CLI/API;
4. verify without printing credentials.

Never touch unrelated R2 buckets `cards`, `mbst1`, or `yakov`.

## Secrets And Git

Never commit:

- `.env`, `.dev.vars`, tokens, OAuth secrets, or R2 keys;
- JPEG/RAW/TIFF media;
- generated derivatives;
- `.next`, `.open-next`, `out`, `node_modules`, or Wrangler local state.

Safe repository content includes source, schemas, migrations, binding names, public
hostnames, non-secret Access AUD/team domain, and example variable files.

## Current Checkpoint

As of 2026-07-27:

- production has migrations through `0005`;
- Access and the owner identity are already configured;
- the full D1-backed admin and public site are deployed as Worker version
  `268bf6db-8df4-4c1d-a1b4-671661d48fca`;
- public home, album index, album viewer, and tag routes return `200`;
- the homepage renders one ordered section per published Set with five popular tags;
- anonymous admin and admin API requests are redirected to Cloudflare Access;
- the owner can open the unified `/admin/albums` workspace in production;
- remote D1 contains 14 albums, 448 photos, 1032 assets, and 3 Sets;
- `PRAGMA foreign_key_check` returns no rows.
