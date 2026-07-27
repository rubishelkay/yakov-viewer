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
  exact owner email

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

## Production Checkpoint

As of 2026-07-27, migrations `0004` and `0005` are applied and Worker version
`0133329c-1253-444f-9f92-9231435034c4` is live on `yakov.shmol.cc`. Public routes
read D1, anonymous admin requests are intercepted by Access, and the owner can use the
unified Albums workspace. Remote D1 has 11 albums, 365 photos, 783 assets, and 2
published Sets with no foreign-key violations. The homepage renders every published
Set as its own ordered album section and shows five tags ranked by album usage inside
that Set.

The remaining release action for this checkpoint is committing and pushing the reviewed
source to `codex/admin-mvp`.

## After Release

The user can now start adding real albums. Product changes are driven by actual upload
friction. Likely later milestones:

- bulk edit and multi-album upload sessions;
- private Google Drive `master` references;
- automatic/queued image processing;
- multi-tag archive search;
- collections and Logjamming;
- GitHub-triggered Cloudflare production builds.

## Done Means

- D1 and R2 are the only active archive store;
- admin routes are owner-only;
- every visible control persists;
- public pages react to publication state;
- no public route exposes sensitive metadata;
- no image bytes or secrets enter Git;
- migrations and foreign keys pass;
- local sessions are stopped before handoff.
