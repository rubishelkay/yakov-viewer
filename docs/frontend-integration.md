# Accepted Frontend Integration

## Source

The accepted public frontend lives outside the repository at:

```txt
/Users/jacobshmol/Documents/q5/proj/yakov/
```

It is a Vite + React Router application and is the visual/interaction source of truth for the public portfolio.

Inventory on 2026-07-17:

```txt
9 albums
312 real photos
4 hero photos
about 1,550 lines of application TypeScript/CSS
about 510 MB prepared JPEGs
about 57 MB thumbnails
```

The parent folder is about 1.2 GB because `dist` duplicates the media. Neither `dist` nor any photo files should be copied into Git.

## Behaviors To Preserve

- fixed minimal header;
- automatic/manual theme behavior;
- fullscreen rotating hero;
- 3:2 album index;
- simple film/digital filtering;
- album S/M/L display modes;
- true-aspect-ratio photo grids;
- fullscreen viewer;
- keyboard, click, swipe, zoom, focus trapping, and deep-linked photo state;
- quiet typography and photo-first spacing.

Current viewing rules:

- M mode uses equal-height flex rows: landscape, portrait, and panorama frames keep
  their natural proportions, while portrait frames become narrower instead of making
  a row taller or leaving a large vertical gap;
- L mode preserves the natural frame but caps landscape images to the visible browser
  height;
- image surfaces show a compact spinner until the selected asset has decoded or failed;
- the fullscreen viewer explicitly contains the complete frame inside the viewport,
  including Safari; a reliable single click/tap then toggles the enlarged view;
- the minimal header hides while scrolling down and returns while scrolling up;
- header icon buttons keep stable dimensions, color, and opacity and only change the
  cursor on hover;
- the favicon uses the `JS` monogram.

## Integration Direction

The current Next.js repository stays canonical. Port the accepted public components into the public route group and adapt them to a shared public repository/read model.

Do not keep two permanent frontend applications. The Vite source remains a reference until parity is verified, then the Next implementation becomes canonical.

```txt
Accepted Vite UI
  -> Next public route components
  -> PublicArchiveRepository
  -> local fixture adapter first
  -> D1/R2 adapter after Cloudflare wiring
```

The public repository returns only published and non-hidden sets, albums, memberships, photos, and public asset versions.

## Local Parity Checkpoint

The first local integration was completed on 2026-07-17:

- the accepted homepage, album index, album S/M/L views, and photo viewer now live in the Next.js public route group;
- the public UI and `/admin` read the same local archive state;
- one published admin-managed set controls the initial public album order and hero selection;
- all 9 real albums and 312 photo records are imported as `isDemo: false`;
- the older fixtures remain in admin with the `Demo` marker but are excluded from the
  production public album layer;
- source JPEGs and thumbnails remain outside this repository.

Regenerate the metadata-only manifest with:

```sh
node scripts/import-fable-manifest.mjs /Users/jacobshmol/Documents/q5/proj/yakov/src/data/albums.json
```

The importer records IDs, dimensions, ordering, paths, tags, and actual file byte counts.
It never copies image bytes. During local development, `NEXT_PUBLIC_ASSET_BASE_URL`
falls back to `http://127.0.0.1:4173`, where the accepted Fable app serves its media.
Production builds default safely to `https://assets.yakov.shmol.cc`; an explicit env value
still takes precedence.

The canonical local archive currently uses persistence version 4. Hosted clients also
normalize stale Fable localhost asset URLs to the production asset domain without
discarding admin edits or IndexedDB previews.

## Homepage Mapping

The accepted visual style stays, but content comes from admin-managed Sets:

- a published hero set supplies the rotating fullscreen slides;
- published index sets supply album sections/order;
- album cards use landscape covers by default;
- fixtures may temporarily reuse covers while the real R2 import is incomplete.

The first integrated frontend still does not need public downloads or Logjamming
controls. A compact first tag slice now exists: controlled tags in album subtitles link
to `/tags/[slug]`, where matching published albums are shown with the canonical album
card. An album matches through its inherited album tags or a direct tag on any public
photo inside it.
Search and multi-tag `AND` filtering remain later work.

## Real Content Import

The 9 source albums are real, not fixtures. Import them as `isDemo: false` records.

Suggested import sequence:

```txt
read albums.json and source folders
  -> create canonical Photo records
  -> create Album records
  -> create AlbumPhoto positions
  -> upload prepared JPEG to private/source or public expanded tier as configured
  -> upload/generate thumb and display tiers
  -> create Asset records
  -> create one initial hero Set and one index Set from the existing order
  -> validate counts and covers
```

The import must be idempotent so it can be tested without duplicating rows or R2 objects.

## Delivery Milestones

1. Completed locally: checkpoint Admin V5 and preserve local behavior.
2. Completed locally: normalize `Photo` and `AlbumPhoto`; localStorage v3 migrates to the canonical v4 model and the D1 draft matches it.
3. Completed locally: port the accepted public frontend against the shared local archive.
4. Completed locally: add OpenNext Worker configuration, typed bindings, local D1/R2 emulation, and a Worker health route.
5. Completed locally: one JPEG upload through the Worker to private R2 + D1, including
   a byte-identical protected readback.
6. Completed remotely: idempotent 9-album import to production D1/R2 with real thumb and
   display assets only.
7. Completed remotely: technical OpenNext Worker, R2 incremental cache, active asset
   domain, and clean-browser media QA.
8. Completed remotely: `yakov.shmol.cc` now routes to the verified Worker.
9. Completed remotely: viewing polish, reverse film order, and first public tag routes.
10. Next: configure Cloudflare Access, enable the external admin, and switch the admin
   repository from local persistence to the full Cloudflare API as one coherent unit.
11. Later: derivative processing, expanded/download tiers, multi-tag archive filtering,
    and GitHub Workers Builds.

Logjamming begins only after the shared archive contract and first real upload are stable.
