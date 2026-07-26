# Cloudflare CLI Checklist

## Resources

```txt
Worker               yakov-viewer
Route                yakov.shmol.cc/*
D1                   yakov_archive
Public R2            yakov-public-assets
Private/future R2    yakov-private-assets
OpenNext cache R2    yakov-next-cache
Asset hostname       assets.yakov.shmol.cc
Access app            Yakov Viewer Admin
Owner                Jacobjshmol@gmail.com
```

Do not touch unrelated buckets `cards`, `mbst1`, or `yakov`.

## Before Remote Work

```sh
pnpm check
pnpm preview
git status -sb
git diff --check
```

Verify:

- public home, albums, one album, one tag, viewer zoom;
- admin albums, photos, sets, tags, settings, Bin;
- no `.env`, `.dev.vars`, tokens, media, or generated build directories in Git;
- no unplanned large files;
- Access tests pass.

## Migration

After the user receives the short production-action brief:

```sh
pnpm exec wrangler d1 migrations apply yakov_archive --remote
pnpm exec wrangler d1 execute yakov_archive --remote \
  --command "PRAGMA foreign_key_check;"
```

Migrations applied in the 2026-07-27 checkpoint:

```txt
0004_cloud_admin.sql
0005_public_web_tiers.sql
```

After applying them, remote `PRAGMA foreign_key_check` returned no rows.

## Deploy

```sh
pnpm run deploy
```

Confirm the deployment still has:

- Worker Route `yakov.shmol.cc/*`;
- `workers_dev=false`;
- preview URLs disabled;
- D1 and all three R2 bindings;
- `ADMIN_ACCESS_ENABLED=true`;
- correct Access AUD/team domain and owner email.

## Production Smoke

The 2026-07-27 deployment completed the non-destructive parts of this checklist. The
existing `Cloud upload smoke test` draft contains 29 photos, so no second temporary
production upload was created.

1. Anonymous `/` and `/albums` return 200.
2. Anonymous `/admin` is intercepted by Access.
3. Owner can open `/admin/albums`.
4. Create a temporary draft album.
5. Upload one controlled JPEG.
6. Confirm three Asset rows and three R2 objects.
7. Publish photo/album and add to a published Set.
8. Confirm public normal view uses display and `+` uses expanded.
9. Confirm Download is absent/off, then enable and verify attachment.
10. Bin and restore preserve publication status.
11. Final purge removes the temporary D1/R2 data.
12. Run `PRAGMA foreign_key_check` again.

## GitHub

After production verification:

```sh
git add <reviewed scope>
git commit -m "finish cloudflare archive admin"
git push origin codex/admin-mvp
```

GitHub-triggered production builds remain a separate follow-up. Manual Wrangler deploy
is the release rail until the first real album-filling sessions are stable.

## Rollback

If the new Worker is unhealthy, deploy the previously known Worker version or remove
the `yakov.shmol.cc/*` Worker Route and reattach the old Pages project. Do not roll back
D1 migrations by deleting tables; use a reviewed forward migration.
