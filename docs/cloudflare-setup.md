# Cloudflare Setup

## Pages

Target deployment:

- Framework: Next.js static export
- Build command: `pnpm build`
- Output directory: `out`
- Production domain: `yakov.shmol.cc`

The app uses `output: "export"` in `next.config.mjs`, so it should deploy as a static Cloudflare Pages site.

## Environment Variables

Set these in Cloudflare Pages:

```txt
NEXT_PUBLIC_SITE_URL=https://yakov.shmol.cc
NEXT_PUBLIC_ASSET_BASE_URL=https://assets.yakov.shmol.cc
NEXT_PUBLIC_IMAGE_TRANSFORM_BASE_URL=https://yakov.shmol.cc
```

Do not commit Cloudflare API tokens, R2 access keys, or secrets.

## R2

Production target:

- public optimized/display assets on `assets.yakov.shmol.cc`;
- private originals/backups in a separate bucket if needed;
- avoid relying on `r2.dev` for production traffic.

The current seed data still points at the original `r2.dev` URLs until real asset-domain migration is done.

Recommended bucket split:

```txt
yakov-public-assets
yakov-private-assets
```

`yakov-public-assets` should contain public thumbnails, display images, cover crops, and large JPEG files that are allowed for public download/open access.

`yakov-private-assets` should contain staging uploads, optional private master files, selected RAW/RAF/TIFF files, and temporary trash objects.

Public R2 delivery should use a custom domain. Cloudflare documents `r2.dev` as a development URL and recommends custom domains for production controls such as caching and access rules.

## Image Transformations

The public site builds fixed Cloudflare image transformation URLs in production. Keep widths constrained to the sets in `src/lib/images.ts` to control caching and transformation cost.

## Admin Access

Initial admin access should be protected through Cloudflare Access for the owner email:

```txt
Jacobjshmol@gmail.com
```

Application-level login can come later for comments, selected users, and private downloads.

## Future Bindings

The admin/backend phase will likely need:

```txt
R2 public bucket binding
R2 private bucket binding
D1 database binding
Queue binding for image processing jobs
```

Specific `wrangler` configuration should be added when the admin Worker or Pages Functions layer is implemented.
