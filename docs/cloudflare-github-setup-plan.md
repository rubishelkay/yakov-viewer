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

## Cloudflare Resources To Create

Recommended resources:

```txt
Cloudflare Pages project
  yakov-viewer

Custom domain
  yakov.shmol.cc

R2 buckets
  yakov-public-assets
  yakov-private-assets

D1 database
  yakov_archive

Queues
  yakov-image-processing

Cloudflare Access
  protect /admin for owner email

Optional later
  Workers Analytics Engine dataset for visits
```

## Preflight Before Implementation

Before real Cloudflare upload work starts, the owner should prepare or confirm:

```txt
1. Cloudflare account access.
2. Domain DNS control for yakov.shmol.cc.
3. GitHub repository connected to Cloudflare Pages.
4. Cloudflare Pages project created or ready to create.
5. R2 public bucket name confirmed.
6. R2 private bucket name confirmed.
7. D1 database name confirmed.
8. Queue name confirmed.
9. Cloudflare Access app planned for /admin.
10. Decision on analytics: placeholder, Web Analytics, Analytics Engine, or later.
11. Google Drive import approach for production: user OAuth, service account, or manual/local fallback.
```

The owner can configure these in Cloudflare dashboard while implementation proceeds.

## Pages Build Settings

Current static build:

```txt
build command: pnpm build
output directory: out
```

As the app moves toward live API routes, Cloudflare Pages Functions or a Worker-backed API should be configured alongside the static shell.

## Domain Plan

Initial production split:

```txt
yakov.shmol.cc
  public static portfolio frontend
  built by Cloudflare Pages from GitHub

assets.yakov.shmol.cc
  public optimized R2 image delivery
  thumbnails, display, expanded, and allowed download JPEGs

admin.yakov.shmol.cc or api.yakov.shmol.cc
  optional future Worker/API surface for admin backend
  protected by Cloudflare Access before production use
```

The first deployment can keep `/admin` inside the Pages app and protect it with Cloudflare Access. A separate third-level backend domain becomes useful when R2/D1 uploads move from local-first UI to live API calls, or when Logjamming needs to read the same archive API.

For the next milestone, prefer one of these two shapes:

```txt
Option A: Pages + Pages Functions
  yakov.shmol.cc/admin
  yakov.shmol.cc/api/admin/*

Option B: Pages frontend + Worker API
  yakov.shmol.cc
  api.yakov.shmol.cc/api/admin/*
```

Option A is simpler for the first Cloudflare upload test. Option B is cleaner if the same backend will be shared by Yakov Viewer and Logjamming soon.

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

For Workers/Pages Functions, prefer Cloudflare bindings over raw keys:

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
5. Cloudflare Pages deploys from GitHub.
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
- no `node_modules`, `.next`, `out`, `.playwright-cli`, logs, or browser artifacts;
- no RAW/RAF/TIFF, high-resolution originals, generated derivatives, or local upload folders;
- temporary admin preview images stay under ignored `public/_admin-previews`;
- Cloudflare templates stay as examples only, with placeholder IDs.

## First Cloudflare Milestone

The first practical milestone can be staged.

Stage A:

```txt
local/admin shell works
D1 schema exists
mock upload flow proves UI
no real secrets committed
```

Stage B:

```txt
admin can upload 5-10 albums
photos land in R2
metadata lands in D1
derivatives are generated
public pages can read published data
```

After this works, visual design iteration becomes much more useful because there will be real content.
