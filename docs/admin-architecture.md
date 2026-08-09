# Admin And Storage Architecture

## Goal

The admin is the owner-only workspace for the Yakov Viewer archive. It manages the same
D1/R2 data rendered by the public portfolio and later reused by Logjamming.

## Runtime

```txt
/admin React UI
  -> typed client actions
  -> protected Next Route Handlers
  -> D1 + R2 bindings
```

The admin and public site live in one Next.js/OpenNext Worker. Cloudflare Access and
application JWT verification allow only `Jacobjshmol@gmail.com`.

## Canonical Model

```txt
Set
  -> ordered Album memberships

Album
  -> ordered AlbumPhoto memberships

Photo
  -> canonical metadata and Assets

Asset
  -> thumb / display / expanded

Tag
  -> album or direct photo relationships

Bin
  -> restore payload/status and purge job
```

One Photo may appear in several Albums. Reusing it creates an AlbumPhoto membership,
not another Photo or Asset. Purging an album removes media only when a photo has no
remaining memberships.

## Working Screens

- Dashboard: live archive/storage/status counts.
- Albums: create, metadata, download policy, Sets, tags, covers, upload, order, status,
  Bin.
- Photos: global canonical library and multi-album memberships.
- LogJam: curator identities, mutable private curations, immutable submitted versions,
  ordered photo review, and owner-only promotion into canonical draft albums.
- Sets: create, publish, order, and album membership.
- Tags: controlled dictionary, usage, edit, safe delete.
- Settings: active publication/download/Bin defaults and storage contract.
- Bin: restore and permanent purge.

There are no decorative upload controls or browser-only archive screens.

## Upload And Publication

```txt
create draft Album
  -> sequential JPEG upload
  -> three public R2 tiers
  -> Photo defaults to review
  -> review order/covers/tags
  -> publish Photo and Album
  -> attach to published Set for homepage
```

The album may remain outside Sets and still appear in `/albums`.

## LogJam Curator Review

LogJam writes only to its own curator, curation, decision, and submission records. A
working curation is private and mutable. Each submit action freezes an immutable,
versioned photo order that the owner reviews in `/admin/logjam` before promotion.

The owner workflow is:

```txt
open curator
  -> distinguish current working curation from submitted versions
  -> open one immutable submission and inspect its ordered thumbnails
  -> resolve any unavailable canonical photos
  -> optionally override the album title
  -> promote once into a canonical draft Album + AlbumPhoto memberships
```

Promotion reuses existing Photo and Asset records; it does not copy R2 objects. The
promoted album stays draft until the owner deliberately publishes it in Albums. A
submission links back to its canonical album and cannot create duplicate albums on a
retry. Once that canonical album has ever been published, the source curation is
visibly and permanently locked even if the album is later unpublished. Unpromoted
submissions may be archived, but their immutable rows and photo order remain auditable.

## Delete Semantics

- `hidden`: unavailable publicly, records and R2 objects remain.
- `Bin`: unavailable publicly, restorable with prior status.
- `purge`: irreversible D1 deletion plus deletion of unshared R2 objects.
- unlink: removes only one AlbumPhoto membership.

Every destructive action uses an explicit custom confirmation.

## Media Policy

Current uploads store public `thumb`, `display`, and `expanded`. The `expanded` tier is
the sanitized input JPEG, not a duplicate private source. Full original scans and
RAW/RAF/TIFF remain in Google Drive.

The private R2 binding and `master` asset type remain available for a later owner-only
archive extension.

## Operational Boundary

The database and R2 buckets are authoritative. Source-code fixtures exist only for
validation/history. Secrets and image files never enter Git.
