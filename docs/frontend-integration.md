# Accepted Frontend Integration

## Visual Contract

The accepted public frontend originated at:

```txt
/Users/jacobshmol/Documents/q5/proj/yakov/
```

Its interface is now integrated into the canonical Next.js application. The external
Vite folder remains reference/source media, not a second production app. No JPEG,
thumbnail, or `dist` media is copied into Git.

## Preserved Behavior

- minimal auto-hiding header and JS favicon;
- system/manual theme;
- fullscreen homepage hero;
- 3:2 album cards;
- S/M/L album modes;
- true-aspect justified M rows;
- viewport-bounded L images;
- stable fullscreen viewer;
- keyboard, swipe, pinch, point-aware zoom, and drag pan;
- Safari-safe contained first view;
- album-based tag pages.

`thumb` is used for grids, `display` for the normal viewer, and `expanded` only after
the visitor requests zoom. Download appears only when the album policy allows it.

## Data Mapping

```txt
published D1 Sets
  -> homepage album order and hero

all published D1 Albums
  -> /albums

AlbumPhoto positions + album reverse flag
  -> album frame order

published Photo + public Assets
  -> viewer

album tags + direct photo tags
  -> tag album pages
```

The public frontend never imports admin mocks and never reads browser persistence.

## Starting Content

The original accepted import contained 9 real albums and 312 photos. They remain valid
production content. Metadata-only fixture/import helpers can stay in source for
validation, but runtime pages now read D1 and media stays in R2.

## Current Release State

Completed in production:

1. Accepted Fable UI ported to Next.
2. OpenNext Worker and Cloudflare bindings.
3. Real D1/R2 archive reads and JPEG upload.
4. Full admin mutations, multi-album photo membership, Sets, Tags, Settings, and Bin.
5. Public pages switched to D1.
6. Three-tier JPEG viewer and album-level Download policy.
7. Metadata sanitization and end-to-end QA.
8. Homepage sections sourced from published Sets with per-Set popular tags.

Logjamming begins after real Yakov Viewer filling proves the shared archive contract.
