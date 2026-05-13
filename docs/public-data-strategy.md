# Public Data Strategy

## Decision

The project should move toward live Cloudflare API reads for public archive data instead of relying only on static generated pages.

Recommended first architecture:

```txt
Cloudflare Pages
  Static public UI shell
  Static admin UI shell

Pages Functions / Workers
  Public API
  Admin API

D1
  Sets, albums, photos, collections, tags, settings

R2
  Public optimized assets
  Private source/master assets
```

Cloudflare Pages Functions can add dynamic server-side code to a Pages project. D1 can be bound to Pages Functions/Workers, and R2 can be bound for asset operations.

## Why Not Pure Static Only

Pure static export is excellent for a small portfolio, but it becomes awkward for:

- admin-driven publishing;
- filtering all photos by multiple tags;
- hiding/unhiding photos without rebuilding every page;
- collections that change often;
- Logjamming reading the same archive.

## Why Not Full Dynamic Everything Immediately

A full dynamic app is more flexible, but it adds complexity before the archive model is proven.

The recommended middle path:

- static shell for speed and reliability;
- live API for data;
- client-side filtering and pagination for archive views;
- optional build-time/static snapshots later for SEO-critical pages.

## Public API Shape

Initial public endpoints:

```txt
GET /api/public/settings
GET /api/public/sets
GET /api/public/albums?tags=bangkok,film
GET /api/public/albums/:slug
GET /api/public/photos?tags=film,bangkok&page=1
GET /api/public/collections
GET /api/public/collections/:slug
```

Public API rules:

- return only published albums;
- return only published photos;
- exclude hidden, trash, and deleted records;
- hide photos whose parent album is not public;
- return public asset URLs only;
- never return private `sourceJpeg`, RAW/RAF/TIFF, or private R2 keys.

## Filtering

For all-photo filtering, use effective tags:

```txt
effective photo tags =
  direct photo tags
  + tags inherited from the parent album
```

Example:

```txt
Album: Film 060
Album tags: Film, Bangkok, 2025

Photo 12 tags: portrait, night

Effective tags:
Film, Bangkok, 2025, portrait, night
```

This allows filters such as:

```txt
Film + Bangkok
Digital + Chiang Mai
Mountains + Film
```

Filtering uses AND logic. Selecting `Film`, then `Bangkok`, narrows the result to photos that match both effective tags.

## Hidden Photos In Collections

Collection membership should remain in D1 even when a photo becomes hidden.

Public API should omit hidden photos. Admin should show a warning that a collection contains hidden items and offer a way to review them.

If the photo is unhidden later, it can reappear in the public collection.
