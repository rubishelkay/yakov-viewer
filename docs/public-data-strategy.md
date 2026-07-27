# Public Data Strategy

## Decision

The public portfolio reads the published subset of `yakov_archive` directly from D1 in
server components. The combined application runs on one OpenNext Cloudflare Worker.
There is no static manifest/localStorage split and no separate Pages Functions app.

```txt
public request
  -> cached public Worker entrypoint
  -> Next server component on a miss/refresh
  -> published-only D1 query
  -> public R2 URLs
```

Routes are dynamic so an admin publication can appear without rebuilding the project.
Successful admin mutations revalidate the public layout tree. Edge HTML can remain
fresh for up to 60 seconds.

## Visibility Rules

- album must be `published`;
- photo must be `published`;
- hidden, draft, review, Bin, and deleted entities are omitted;
- cover fallback can use only a published photo and public asset;
- only public `thumb`, `display`, and `expanded` URLs are returned;
- no private key, EXIF/GPS, Google Drive URL, RAW, or TIFF enters the public model.

## Route Semantics

```txt
/                 one section per published Set, ordered by Set then membership
/albums           every published album, ordered globally
/albums/:slug     published photos in AlbumPhoto order
/tags/:slug       published albums with the album/effective photo tag
/about            static accepted copy
```

An album may be published and intentionally absent from the homepage by leaving it
outside every published Set. The same album may appear in several homepage sections
without duplicating its Photo or Asset records. Each section shows up to five popular
tags, ranked by the number of its albums carrying that album/effective-photo tag.

## Images And Download

Cards and dense grids use `thumb`. Normal viewing uses `display`. Viewer zoom
lazy-loads `expanded`. An album-level policy controls whether a Download command is
rendered; the route streams `expanded` as an attachment only when allowed.

## Tags

Public album filter tags are the union of:

```txt
album tags
+ direct tags of published photos in that album
```

Tag pages return albums, matching the accepted public design. Future All Photos
multi-filtering can use effective photo tags with AND logic without changing storage.

## Caching

R2 asset URLs are immutable and cache for one year. D1-backed HTML is rendered
dynamically on cache fill, then Cloudflare Workers Caching keeps it fresh for 60
seconds with `stale-while-revalidate` and `stale-if-error` resilience.

The default Worker entrypoint remains uncached. Only normal public HTML `GET` requests
are delegated to the cached `PublicFrontend` entrypoint. `/admin`, `/api`, `/_next`,
mutations, and React Server Component requests never enter the public document cache.
Fine-grained cache-tag purge after admin mutations can replace the short TTL later.
