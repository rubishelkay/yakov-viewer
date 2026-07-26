# Yakov Viewer Working Rails

This document records how we work on the project so the plan does not live only in chat history.

## Current Decision

Use one main Codex chat for the project until the first real upload milestone is complete.

The project is still one tightly coupled system:

- admin UX;
- archive data model;
- local repository layer;
- Cloudflare API contract;
- R2 file layout;
- D1 schema;
- image pipeline;
- public portfolio views.

Splitting into two permanent chats now would create more coordination cost than value.

## Claude / Second Opinion

Claude is not a second worker by default. Use Claude only as a short read-only reviewer when:

- the user explicitly asks for Claude / Opus;
- the decision is architecture, migration, security, or Cloudflare-risky;
- Codex is choosing between two approaches and wants a compact second opinion;
- a risky diff is about to be finalized.

Do not send the whole repository. Send only the goal, constraints, relevant paths, compact summary, and exact question.

## When A Second Chat Becomes Useful

Open a separate backend/Cloudflare chat only after this milestone works end to end:

```txt
create album
  -> select JPEG
  -> upload source JPEG to R2
  -> create D1 photo/asset records
  -> generate or register web derivatives
  -> reload admin
  -> see the uploaded photo from Cloudflare-backed data
```

After that, backend work can be separated because the contract will be real instead of hypothetical.

Good future split:

- main chat: product, admin UX, public portfolio, data contract, release decisions;
- backend chat: D1 migrations, R2 lifecycle, Cloudflare Access, signed uploads, queues, operational deployment.

## Source Of Truth

The source of truth is the repository, not chat memory.

Important decisions should be written into docs:

- `docs/project-decisions-ru.md` for product decisions in Russian;
- `docs/admin-architecture.md` for admin/storage architecture;
- `docs/admin-api-contract.md` for API shape;
- `docs/admin-upload-roadmap-ru.md` for the current admin status and production-upload path;
- `docs/image-pipeline.md` for photo versions and processing;
- `docs/cloudflare-setup.md` for Cloudflare setup;
- this file for collaboration/workflow rules.

## Current Stage

The current branch is:

```txt
codex/admin-mvp
```

Current status:

- Next.js public routes remain prerender-first where practical.
- Public/admin route split exists.
- Existing editor screens are local-first; a separate Cloud-backed ingest screen now
  exists at `/admin/ingest` so browser and Cloudflare state are never silently mixed.
- `/admin/ingest` is isolated at the route-layout level from the local
  localStorage/IndexedDB provider, and admin navigation disables eager route prefetch.
- Metadata persists in `localStorage`.
- JPEG previews persist in IndexedDB.
- Unused Cloudflare Pages Function stubs have been removed.
- D1 migration draft exists.
- The first local Cloudflare-backed ingest slice is working: D1 archive reads, draft
  album creation, browser-generated `thumb`/`display`, optional unchanged private
  `sourceJpeg`, D1 metadata writes, authenticated asset reads, ordered batch upload,
  and idempotent retry.
- The visible editor screens still use the local browser repository until all essential
  edit mutations have Cloudflare API equivalents. `Cloud upload` is explicitly isolated
  and uses only D1/R2.
- A finished external Vite frontend has been accepted as the public visual contract.
- It contains 9 real albums and 312 real photos that will become the first R2/D1 import.
- Its homepage, album index, S/M/L album views, and viewer are now integrated locally into the Next.js public routes.
- The public routes and admin currently share one local archive seed; development media
  can come from the external Fable server, while production media now comes from R2 and
  remains outside Git.
- Canonical `AlbumPhoto` memberships now control multi-album reuse and album-specific ordering without duplicating Photo or Asset records.
- localStorage archives migrate from version 3 to version 4 automatically; IndexedDB preview blobs keep their existing IDs.
- The long-term deployment target is now one Next.js/OpenNext Cloudflare Worker, not static Pages export.
- OpenNext configuration, compact binding types, local D1/R2 emulation, and `/api/health` now work.
- `0001_archive.sql` passes a local D1 migration and foreign-key check.
- The generated Worker passes local `workerd` checks for public, admin, and API routes.
- Production `yakov_archive` now contains the first 9 albums, 312 photos, and 624 real
  thumb/display assets with a clean foreign-key check.
- The technical OpenNext Worker is live and uses a dedicated R2 incremental cache.
- `assets.yakov.shmol.cc` is active, and `yakov.shmol.cc/*` now routes to the verified
  OpenNext Worker. The old Pages project remains detached but available for rollback.
- Cloudflare Access now protects both admin page and API path families for exactly the
  owner account. Migration `0003_upload_job_photo.sql` is applied and Worker version
  `dd98686e-673e-41fa-b816-d57cfc4f1131` runs with server-side Access JWT validation.
  Owner consent, protected archive reads, album creation, browser derivative generation,
  private source retention, D1 writes, R2 readback, and one production smoke upload pass.
- Album display order can now be reversed with one album-level setting; membership
  positions stay canonical and are not destructively renumbered.
- Public viewing polish now includes stable header controls, image loading feedback,
  edge-to-edge justified M rows, viewport-bounded L images, point-aware zoom with
  drag panning, touch pinch/pan constrained to the rendered photo, a stable non-flickering
  swipe viewer, a dynamic full-height mobile hero, and a direction-aware auto-hiding header.
- Controlled album tags now have first public `/tags/[slug]` pages. Multi-tag filtering
  remains a later archive milestone.
- The July 18 frontend refinement is live as Worker version
  `3000d166-ad54-4963-9b17-2aaf52f0bdf0`: JS favicon, stable header controls,
  Safari-safe contained viewer with point-aware zoom and drag panning, edge-to-edge
  justified M rows, and album-based tag results.
- The July 19 mobile Safari correction is live as Worker version
  `8df2baa5-67dd-4602-a2ca-6b264ba56552`: the hero follows the dynamic viewport,
  swipe navigation keeps one opaque viewer mounted, pinch/pan is constrained to the
  rendered photo, and the close control no longer receives forced initial focus.
  Production D1 migration `0002_album_photo_order.sql` remains applied and its
  foreign-key check is clean.
- The July 21 protected-admin rollout is live as Worker version
  `652010be-06b1-49e6-a051-6a1a878be02a`: Access intercepts anonymous admin requests,
  the Worker validates owner JWTs, and migration `0003_upload_job_photo.sql` is applied
  with a clean foreign-key check.
- The July 26 production upload checkpoint is live as Worker version
  `dd98686e-673e-41fa-b816-d57cfc4f1131`: one draft album and one real JPEG completed
  the browser -> Worker -> private/public R2 -> D1 round trip. The source matched the
  local SHA-256, derivatives matched D1 metadata, and the draft stayed non-public.

## Immediate Roadmap

### 0. Current Preparation Pass

Goal: keep the next work from drifting before touching Cloudflare.

Current decisions:

- polish admin UX before real R2/D1 upload;
- keep the work in one main chat for now;
- use fake/demo albums as long-lived development fixtures, not as throwaway accidents;
- first real upload is JPEG-only, with RAW/RAF/TIFF represented in the model for later private/master storage;
- Codex should prepare Cloudflare setup checklists first. The owner can create resources in the Cloudflare dashboard when automation is brittle or blocked.

Done when:

- the roadmap and open decisions are written in repo docs;
- the next implementation pass has a small, testable scope;
- no server, Cloudflare resource, or git push is triggered accidentally.

### 1. Stabilize Local Admin UX

Goal: make the admin comfortable enough to use before real storage.

Focus:

- albums;
- sets;
- all photos;
- tags with autocomplete;
- bin/delete flow;
- cover priority and cover assignment;
- photo ordering;
- bulk album work, including 30-40 photo albums and several albums in one session;
- local reset/seed behavior.

Done when:

- a 30-40 photo album is usable without visual clutter;
- creating several albums in a row feels predictable;
- reload keeps local state;
- hidden/delete/bin behavior is predictable;
- no decorative controls pretend to work.

### 2. Freeze Shared Archive Contract

Goal: make one TypeScript model that local admin, D1, and public API can share.

Status: canonical `Photo + AlbumPhoto` relation completed locally and reflected in the D1 draft. The remaining contract work is the Cloudflare repository/API implementation.

Focus:

- `Set`;
- `Album`;
- `Photo`;
- `Asset`;
- `Tag`;
- `Collection`;
- `AdminSettings`;
- statuses;
- IDs and slugs;
- inherited tags;
- album/photo/set ordering.
- canonical photos with `AlbumPhoto` membership so one photo can appear in several albums without duplicate assets.

Done when:

- UI code does not invent data fields ad hoc;
- D1 migration matches the frontend contract;
- docs and types use the same naming.

### 3. Keep Data Access Behind Repository Interfaces

Goal: make Cloudflare replacement possible without rewriting UI.

Current local implementation:

```txt
Admin UI
  -> admin repository interface
  -> localStorage + IndexedDB
```

Future implementation:

```txt
Admin UI
  -> admin repository interface
  -> /api/admin/*
  -> D1 + R2 + queue/image processing
```

Done when:

- UI components do not directly know storage details;
- local repository and future Cloudflare repository can expose the same actions.

### 4. Integrate The Accepted Public Frontend

Goal: preserve the accepted Vite design while making all homepage and album content come from the shared archive model.

Status: local parity checkpoint completed. Cloudflare-backed data and final visual acceptance remain.

Focus:

- port the fullscreen hero, album index, S/M/L album views, and viewer;
- drive the homepage from published admin Sets;
- keep All Photos and public downloads out of the first parity milestone;
- use fixtures until the Cloudflare-backed repository is ready;
- do not copy the source media into Git.

### 5. First Real Cloudflare Upload

Goal: one real JPEG upload path, not the full final system.

Minimum flow:

```txt
create album
  -> send JPEG to the protected Worker endpoint
  -> Worker writes thumb/display to public R2
  -> Worker writes every source JPEG unchanged to private R2
  -> Worker writes Photo, AlbumPhoto, Asset, and UploadJob rows to D1
  -> admin reloads the archive through the Cloudflare API adapter
```

The first implementation intentionally uses a direct multipart request through the
protected Worker. This is simpler to validate end to end. Presigned/direct-to-R2
uploads can replace it later if file sizes or concurrent uploads require that change.
The current ingest creates real `thumb` and `display` JPEGs in the browser and preserves
the unchanged `sourceJpeg` for every upload. It never creates
placeholder derivative records.

Immediate implementation order:

1. Completed locally: typed D1 queries and `GET /api/admin/archive`.
2. Completed locally: album creation against D1.
3. Completed locally: ordered batch JPEG upload with real `thumb`/`display` in public
   R2, mandatory unchanged `sourceJpeg` in private R2, transactional D1 writes,
   compensating R2 deletion, and idempotent retry.
4. Completed locally: separate D1/R2-backed `Cloud upload` workspace and typed client
   boundary for archive reads, album creation, JPEG upload, and protected asset reads.
5. Next: configure Access, apply production migration 0003, deploy, and run a small
   remote smoke upload.
6. Then: add the remaining album/photo/set/tag/settings/bin mutations and switch the
   whole admin repository as one coherent unit.
7. Completed: production resources, migrations 0001-0002, first real album/media import, technical
   Worker deployment, and asset-domain verification.
8. Completed: switch the public hostname to the verified Worker Route.

Cloudflare setup approach:

- Codex prepares exact resource names, bindings, env var names, and dashboard steps;
- the owner can create or confirm Cloudflare resources manually;
- Codex uses Wrangler/Cloudflare API for Cloudflare changes, not browser automation by
  default. Every remote mutation still gets a short pre-action brief and explicit
  confirmation.

### 6. Image Derivatives

Goal: generate/register the real file versions.

Target versions:

```txt
thumb
display
expanded
downloadJpeg
sourceJpeg
master later
```

First real version can be JPEG-only. RAW/RAF/TIFF stays future/private.

The first uploader should still model `master` assets so selected RAW/RAF/TIFF files can be attached later without redesigning albums or photos.

### 7. Import The Accepted Real Albums

Goal: import the 9 albums and 312 prepared JPEGs from the accepted frontend into D1/R2 through an idempotent importer.

### 8. Public Portfolio From Cloudflare Data

Goal: public pages read published sets/albums/photos safely.

Focus:

- homepage from published sets;
- album pages;
- all photos with AND tag filtering;
- photo detail pages;
- responsive image URLs;
- no private/source assets exposed.

## Safety Rules Before Push Or Deploy

Run:

```txt
pnpm check
git status -sb
```

Also check:

- no `.env` or secrets;
- no Cloudflare tokens;
- no R2 keys;
- no RAW/TIFF/source originals;
- no generated derivatives;
- no `node_modules`;
- no `.next`;
- no `out`;
- no unintended large files.

Before externally visible actions, give the user a short brief because voice dictation can contain transcription mistakes.
