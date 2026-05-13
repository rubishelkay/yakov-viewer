# Admin And Storage Architecture

## Goal

The admin is a private archive workspace on Cloudflare infrastructure. It should let the user:

- create sets;
- create albums;
- upload photos into albums;
- preserve upload order;
- review images before publication;
- edit metadata and tags;
- create curated collections from photos across albums;
- configure global media delivery defaults;
- assign cover images;
- hide individual photos;
- publish albums;
- delete photos and albums when needed;
- keep unpublished material private.

## Recommended Cloudflare Stack

```txt
Cloudflare Pages
  Public Next static site
  Admin frontend route or separate admin app

Cloudflare Access
  Protects admin access for the owner email first

Cloudflare Workers / Pages Functions
  Admin API
  Upload orchestration
  Signed upload URLs
  Metadata writes
  Delete/trash actions

Cloudflare R2
  Public display assets
  Private large/private/master assets

Cloudflare D1
  Sets, albums, photos, tags, asset records, permissions, audit events

Cloudflare Queues
  Async image processing jobs
```

Initial admin access can be protected through Cloudflare Access for:

```txt
Jacobjshmol@gmail.com
```

Later phases may add application-level Google login for comments, selected downloads, and collaborator access.

## Buckets

Recommended buckets:

```txt
yakov-public-assets
yakov-private-assets
```

`yakov-public-assets`:

- thumbnails;
- display images;
- cover crops;
- optimized public expanded images;
- optional optimized public download JPEGs;
- public download files only when explicitly allowed.

`yakov-private-assets`:

- staging uploads;
- uploaded large JPEG source files;
- private master files;
- optional RAW/RAF/TIFF files for selected photos;
- deleted/trash files before permanent purge.

Production public assets should use a custom domain such as:

```txt
assets.yakov.shmol.cc
```

Avoid using `r2.dev` for production delivery.

## Upload Flow

```txt
1. Admin creates or opens an album.
2. Admin uploads a batch of JPEG files.
3. API creates photo records in draft/review status.
4. Uploaded source JPEG is stored as private/admin asset.
5. Processing job creates thumb, display, expanded public preview, optional download JPEG, and cover-ready derivatives.
6. Metadata is extracted and sanitized.
7. Admin reviews ordering, visibility, metadata, and covers.
8. Admin publishes the album.
```

The first implementation can process only JPEG uploads. RAW/RAF/TIFF support should be modeled but not required for the first working admin.

The public site should not casually expose the original 5-30 MB uploaded JPEG. Public viewing should use optimized derivatives in most cases. Larger public download/open access can be enabled per album or per photo later.

## Global Admin Settings

The admin should include a compact settings area for defaults that can be changed later without code edits.

Recommended settings:

```txt
defaultAlbumStatus: draft
defaultPhotoStatus: review
expandedTargetMb: 2-3
publicDownloadMode: downloadJpeg
downloadJpegTargetMb: 3-4
sourceJpegPublicAllowed: false
trashRetentionDays: 7
derivativeColorProfile: srgb
sourceJpegPolicy: preserve
publicExifPolicy: stripSensitive
```

Album and photo settings can override global defaults where needed.

The admin should still allow changing `publicDownloadMode` to `none`, `expanded`, or `downloadJpeg`.

## Hidden Vs Delete

`hidden`:

- remove from public pages;
- remove from sitemap and public archive;
- keep files in R2;
- keep record in admin;
- allow restore to published.

`trash`:

- remove from public pages;
- keep files temporarily;
- allow restore for a grace period, for example 7 days;
- when an album is moved to trash, its photo records and related public appearances should also become non-public.

`delete`:

- delete all related files from R2;
- keep minimal audit metadata if useful;
- cannot be undone after purge.

If public files remain at stable public URLs, hidden photos may still be accessible by someone who already has the direct asset URL. That is acceptable for the early version unless stronger access control is explicitly required.

Album delete should be a soft delete first:

```txt
confirm -> album to trash -> photos to trash -> collections hide affected photos -> purge later
```

The admin should show a clear confirmation dialog before trashing an album. Permanent purge from trash should be a separate action.

## Shared Archive Principle

The database and buckets should be designed as the source of truth for more than one app. Yakov Viewer and Logjamming should read from the same archive rather than duplicating uploads.

This means the data model should avoid public-site-specific assumptions. A photo can exist privately before it belongs to any public portfolio view.

## Admin Placement Options

The first admin can be built in the same repository or as a separate app.

Recommended first step:

```txt
same repository
  /admin static frontend
  Cloudflare Access protection
  Workers / Pages Functions API
```

This keeps the project easier to develop while preserving a clean separation between public pages and private API actions.

The admin can be split into a separate app later if it grows into a heavier archive product.
