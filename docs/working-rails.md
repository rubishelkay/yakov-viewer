# Yakov Viewer Working Rails

## Рабочая модель

До стабильного наполнения первых настоящих альбомов проект остается в одном основном
Codex task. Админка, D1/R2 contract и публичный сайт пока меняются вместе, поэтому
разделение на независимые backend/frontend чаты добавит лишнюю синхронизацию.

Claude используется только как короткий read-only reviewer для рискованных решений.
Репозиторий, миграции и docs являются источником истины, а не память чата.

Пользователь часто диктует в шумной обстановке. Перед migration, deploy, purge, push,
переключением домена или другим внешне видимым действием Codex дает мини-бриф и
перепроверяет спорные имена.

## Текущая архитектура

```txt
Next.js + OpenNext Worker
  public portfolio
  /admin
  admin/public route handlers

Cloudflare Access
  exact owner email for /admin
  invited curator emails for LogJam writes

Separate LogJam Worker
  public published-album catalog
  /auth/start* and /api/private/* protected by Access
  global keep/pass decisions and mixed-photo curations

D1 yakov_archive
  source of truth for sets, albums, memberships, photos, tags, settings, Bin

R2 yakov-public-assets
  thumb, display, expanded

R2 yakov-private-assets
  reserved for future private master/staging files
```

Public pages and admin now read the same D1 archive. Runtime localStorage/IndexedDB
repositories are removed. The accepted Fable-derived visual design remains canonical.

## Completed Milestone

The full local flow works:

```txt
create draft album
  -> select JPEG batch
  -> sanitize metadata and build browser derivatives
  -> upload three JPEG tiers to R2
  -> write D1 records
  -> edit order, covers, tags, status, Sets
  -> publish
  -> see the same records on the public site
  -> hide/Bin/restore/purge safely
```

One Photo can belong to several Albums through `AlbumPhoto`; assets are never copied.
Homepage membership comes from published Sets. `/albums` contains every published
album. Download is controlled per album, while viewer zoom always uses expanded.
Set membership is edited as one checkbox selection, albums inside a Set support
drag-and-drop ordering, and all three cover slots are independent.

## Production Checkpoint

Migrations `0004` and `0005` are applied on production. Public routes read D1,
anonymous admin requests are intercepted by Access, and the owner uses the unified
Albums workspace. Live content counts are intentionally not recorded here because the
archive is now being filled continuously. The homepage renders every published Set as
its own ordered album section and shows five tags ranked by album usage inside that Set.

Public HTML uses a short Cloudflare edge cache. Admin, API, assets, and React Server
Component requests stay uncached. A batch interrupted by a Worker failure keeps every
photo already committed to D1/R2; resume by uploading only the missing files. Public
album grids reveal cards in ordered batches of 15 while image elements keep native lazy
loading.

Album pages end with previous/next navigation in published archive order; the copyright
year comes from the Worker runtime clock. A Random photo deep link renders its selected
display image before mounting the contact sheet, then preloads adjacent frames and lets
the remaining grid continue lazily.

Before the 2026-07-30 usability update, source commit `efdf3ee` was preserved as Git
tag `yakov-viewer-checkpoint-2026-07-30`. A matching D1 metadata export is kept outside
the repository at `~/Downloads/yakov_archive_checkpoint_2026-07-30.sql`.

## After Release

The user can now start adding real albums. Product changes are driven by actual upload
friction. Likely later milestones:

- paginate or split the growing admin archive snapshot;
- purge public HTML cache tags immediately after publishing;
- bulk edit and multi-album upload sessions;
- private Google Drive `master` references;
- automatic/queued image processing;
- multi-tag archive search;
- collections;
- GitHub-triggered Cloudflare production builds.

## LogJam Local Checkpoint

The curator product is implemented as a separate `logjam/` Worker and SPA in this
repository. It reads only published canonical albums/photos from the shared D1 and
never copies media. Public browsing is anonymous; the first write is replayed after an
invite-only Cloudflare Access email-OTP login. Decisions are global per user/photo,
and private curations can combine photos from any source album.

Submit seals immutable, ordered versions. `/admin/logjam` lets the owner review a
version and atomically promote it into one canonical draft Album. The source curation
locks permanently after that Album has ever been published. Database triggers,
request-size guards, mutation rate limits, and per-user/per-curation caps enforce the
first small-cohort operating envelope.

No production LogJam migration, Access application, domain, Worker deployment, GitHub
push, or build integration is implied by the local implementation. Those external
changes require a separate exact brief and owner confirmation.

## Done Means

- D1 and R2 are the only active archive store;
- admin routes are owner-only;
- every visible control persists;
- public pages react to publication state;
- no public route exposes sensitive metadata;
- no image bytes or secrets enter Git;
- migrations and foreign keys pass;
- local sessions are stopped before handoff.
