# Cloudflare And GitHub Setup Plan

## Goal

The project should be safe to push to GitHub and deploy to Cloudflare without committing secrets, local build artifacts, or uploaded photo files.

The old production site currently associated with `yakov.shmol.cc` has no preservation value for this project and may be overwritten by the new Yakov Viewer deployment after the GitHub/Cloudflare pipeline is ready.

## Git Rules

Commit:

- source code;
- docs;
- schema/migration files;
- config templates;
- `.env.example`;
- small public assets such as icons.

Do not commit:

- `.env`;
- Cloudflare API tokens;
- R2 access keys;
- downloaded source photos;
- generated local image derivatives;
- `node_modules`;
- `.next`;
- `out`;
- local Playwright/browser artifacts;
- logs;
- temporary files.

The repo already has `.gitignore`; keep extending it as new generated folders appear.

## Production Resources

Recommended resources:

```txt
Cloudflare Workers project
  yakov-viewer

Custom domain
  yakov.shmol.cc

R2 buckets
  yakov-public-assets
  yakov-private-assets
  yakov-next-cache

D1 database
  yakov_archive

Optional queue after the first direct upload
  yakov-image-processing

Cloudflare Access
  protect /admin for owner email

Optional later
  Workers Analytics Engine dataset for visits
```

## Bootstrap Status: 2026-07-18

Wrangler is authenticated for the project owner's Cloudflare account. Credentials live
in Wrangler's system configuration outside this repository.

Current remote state:

```txt
D1 databases
  yakov_archive: created, migrated, seeded

Project R2 buckets
  yakov-public-assets: 624 initial JPEG objects
  yakov-private-assets: ready for future source uploads
  yakov-next-cache: populated by OpenNext

Pages
  yakov-viewer
  production branch: main
  retained without yakov.shmol.cc for rollback
  Git integration: connected

Workers
  yakov-viewer: deployed and verified at workers.dev and yakov.shmol.cc/*

Domains
  assets.yakov.shmol.cc: active on public R2
  yakov.shmol.cc: active Worker Route over the existing proxied DNS record
```

The existing R2 buckets have not been inspected or changed and must not be reused by
assumption. The new archive uses clearly named, isolated buckets.

The unrelated legacy buckets `cards`, `mbst1`, and `yakov` were not changed. Cloudflare
Access and Workers Builds are not configured yet.

## Preflight Before Implementation

Before real Cloudflare upload work starts, the owner should prepare or confirm:

```txt
1. Cloudflare account access.
2. Domain DNS control for yakov.shmol.cc.
3. GitHub repository connected to Cloudflare Workers Builds.
4. Existing Pages project inspected before replacement; new Worker project ready to create.
5. R2 public bucket name confirmed.
6. R2 private bucket name confirmed.
7. D1 database name confirmed.
8. Queue name confirmed.
9. Cloudflare Access app planned for /admin.
10. Decision on analytics: placeholder, Web Analytics, Analytics Engine, or later.
11. Google Drive import approach for production: user OAuth, service account, or manual/local fallback.
```

The owner can configure these in Cloudflare dashboard while implementation proceeds.

## Worker Build Settings

Target OpenNext build:

```txt
build command: pnpm exec opennextjs-cloudflare build
production deploy command: pnpm exec opennextjs-cloudflare deploy
non-production deploy command: pnpm exec opennextjs-cloudflare upload
Worker entry: .open-next/worker.js
static assets: .open-next/assets
```

Workers Builds should run from GitHub after the manual hostname cutover is healthy. The
repository already contains the real production bindings in `wrangler.jsonc` and a
working OpenNext configuration, including the R2 incremental cache.

Current official OpenNext Workers Builds values:

```txt
build command: npx @opennextjs/cloudflare build
production deploy command: npx @opennextjs/cloudflare deploy
non-production deploy command: npx @opennextjs/cloudflare upload
production branch: main
root directory: repository root
```

`upload` creates a Worker version without promoting it to the active production
deployment. This is the safer default for non-production branches.

## Domain Plan

Initial production split:

```txt
yakov.shmol.cc
  public portfolio, /admin, and /api
  one Next.js/OpenNext Worker built from GitHub

assets.yakov.shmol.cc
  public optimized R2 image delivery
  thumbnails, display, expanded, and allowed download JPEGs

yakov.shmol.cc/admin
  protected by Cloudflare Access before production use
```

Keep `/admin` and `/api/admin/*` in the same Worker for the first production version. A separate `api.yakov.shmol.cc` becomes useful only if Logjamming later needs an independently deployed shared API.

Current chosen shape:

```txt
One OpenNext Worker
  yakov.shmol.cc
  yakov.shmol.cc/admin
  yakov.shmol.cc/api/admin/*
```

## Environment Variables And Secrets

Public environment variables can go in `.env.example`:

```txt
NEXT_PUBLIC_SITE_URL=
NEXT_PUBLIC_ASSET_BASE_URL=
NEXT_PUBLIC_IMAGE_TRANSFORM_BASE_URL=
```

Secrets must be configured in Cloudflare, not committed:

```txt
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_API_TOKEN
R2 credentials if needed
analytics read token if needed
```

For Workers, prefer Cloudflare bindings over raw keys:

```txt
D1 binding
R2 bucket binding
Queue binding
Analytics Engine binding
```

## Deployment Flow

Recommended workflow:

```txt
1. Develop locally.
2. Run validate/typecheck/lint/build.
3. Review git status and ignored files.
4. Commit to GitHub.
5. Cloudflare Workers Builds deploys a preview from GitHub.
6. Cloudflare environment provides bindings/secrets.
7. Admin is protected by Cloudflare Access.
```

Because many project instructions are dictated by voice, pause with a short pre-action brief before risky steps such as pushing, overwriting production, changing DNS, or deleting Cloudflare resources.

## Pre-Push Checklist

Before every push:

```txt
pnpm check
git status -sb
git ls-files --others --exclude-standard
```

Also verify:

- no `.env`, `.dev.vars`, Cloudflare tokens, R2 credentials, Google tokens, or private keys;
- no `node_modules`, `.next`, `.open-next`, `out`, `.playwright-cli`, logs, or browser artifacts;
- no RAW/RAF/TIFF, high-resolution originals, generated derivatives, or local upload folders;
- temporary admin preview images stay under ignored `public/_admin-previews`;
- `wrangler.jsonc` contains the approved production D1 UUID and named R2 bindings, but
  no credentials or tokens.

## First Cloudflare Milestone

The first practical milestone can be staged.

Stage A - completed locally:

```txt
local/admin shell works
D1 schema exists
real local D1/R2 upload path works through OpenNext Worker
private JPEG readback is byte-identical
mock upload flow proves UI
no real secrets committed
```

Stage B - remote preview resources, not production:

```txt
create isolated preview D1/R2 resources through Wrangler
apply migration to preview D1
deploy/upload preview Worker through OpenNext CLI
protect preview /admin and /api/admin before upload testing
upload one disposable JPEG
verify D1 metadata and private R2 readback
```

Stage C - production-ready workflow:

```txt
admin can upload 5-10 albums
photos land in R2
metadata lands in D1
derivatives are generated
public pages can read published data
```

Stage D - external switch:

```txt
completed: move yakov.shmol.cc from Pages to the verified Worker Route
completed: leave the old Pages project available for rollback
connect the Worker to GitHub Workers Builds
confirm preview branch build uses upload, not production deploy
protect production /admin and /api/admin with Access
```

Detailed command-by-command handoff: `docs/cloudflare-cli-checklist.md`.
