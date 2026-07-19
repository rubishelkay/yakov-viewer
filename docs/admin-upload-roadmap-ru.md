# Панель управления: текущий статус и ближайший путь

## Главное решение

Публичный фронтенд принят и считается визуально замороженным. Следующий приоритет —
настоящая загрузка альбомов через Cloudflare.

В админке временно существуют два явно разделённых режима:

- `/admin/albums` — локальная UX-песочница. Метаданные живут в `localStorage`, preview
  живут в IndexedDB. Этот экран подходит для тестирования интерфейса, но не для
  настоящего архива.
- `/admin/ingest` (`Cloud upload`) — Cloudflare-backed загрузчик. Он читает D1, создаёт
  draft-альбомы и пишет JPEG-версии в R2. Этот экран является основой для реальной
  загрузки.

Нельзя считать локальные Albums и Cloud upload одной базой: это намеренно разные
источники данных, пока для всех редакторов не реализованы Cloudflare mutations.

## Что уже работает

Локальный OpenNext Worker проверен на настоящих JPEG:

```txt
create draft album
  -> select several JPEGs
  -> keep selected file order
  -> create thumb in browser (target <= 300 KB)
  -> create display in browser (target about 1 MB)
  -> upload thumb/display to public R2
  -> optionally preserve selected source JPEGs in private R2
  -> write Photo, AlbumPhoto, two or three Asset rows and UploadJob to D1
  -> reload and see the album/photo count from D1
```

Retry uses a stable client upload ID. Repeating the same request returns the existing
photo instead of creating a duplicate.

Verified sample result on 2026-07-19:

- two JPEGs retained positions 1 and 2;
- each photo created `thumb`, `display`, and `sourceJpeg` assets;
- thumbs were 36-68 KB;
- display files were 473-809 KB;
- source JPEGs stayed unchanged and private;
- no uploaded image was written into Git.

That sample verified the optional source-retention path. Production defaults to web
derivatives only. The `Keep source JPEG in private R2` checkbox is off unless the owner
explicitly chooses it for a selected upload.

## Free-plan storage rule

The first production archive must remain inside the 10 GB-month R2 Standard free tier.
For an expected 100 film albums (about 3,600 photos), retaining every 3-5 MB input JPEG
would consume roughly 11-18 GB before derivatives. The default upload therefore stores:

- public `thumb`, target no more than 300 KB;
- public `display`, target around 1 MB and normally smaller;
- private `sourceJpeg` only when its checkbox is enabled.

Full originals remain on external owner storage, such as Google Drive. The data model
still supports optional `sourceJpeg` and future `master` assets without duplicating the
photo record.

## Почему production-админка ещё не готова для настоящего альбома

Production currently keeps external admin access disabled. Before the first real
upload we still need to:

1. Configure Cloudflare Access for `/admin/*` and `/api/admin/*` with owner email
   `Jacobjshmol@gmail.com`.
2. Apply production migration `0003_upload_job_photo.sql`.
3. Deploy the verified Worker with `ADMIN_ACCESS_ENABLED=true`.
4. Run one small production smoke upload with source retention off and verify D1,
   public R2 and reload.

Until those four steps are complete, do not use the local Albums screen as permanent
storage and do not upload a real album to production.

## First production upload scope

The first remote version intentionally supports only safe ingest:

- create a draft album;
- select many JPEGs in the desired order;
- process and upload sequentially;
- choose source retention only for exceptional files;
- see progress and retry failed files;
- reload and confirm stored photo count.

Publishing, title/subtitle editing, tags, sets, cover editing, reorder after upload,
hide/delete/bin and public-site synchronization are the next Cloudflare mutation pass.
Albums stay draft until that pass is ready.

## Next milestones

### A. Activate protected Cloud upload

- Cloudflare Access;
- production migration 0003;
- deploy;
- one small smoke album;
- then a 30-40 photo test album.

### B. Move essential album editing to Cloudflare

- edit album title/subtitle/status;
- tags with inherited photo tags;
- cover selection;
- forward/reverse display and manual order;
- hide/show photo;
- delete to Bin, restore and purge;
- set membership and set order.

After this milestone, `/admin/albums` can switch from the local repository to D1/R2 as
one coherent unit.

### C. Make the public frontend read Cloudflare archive data

- published sets and albums only;
- public `thumb`/`display` URLs only;
- no source keys or private metadata;
- cache invalidation after publish;
- existing accepted visual design remains unchanged.

## Operating rule

For real content, the final workflow will be the remote protected admin. Local admin
remains a development sandbox and recovery/testing tool. Cloudflare changes are made
through Wrangler/API after a short pre-action brief; secrets and image files stay out
of Git.
