# Cloudflare CLI Checklist

This is the current operational rail for Yakov Viewer. Use Wrangler or the Cloudflare
API; do not put credentials, image files, or generated output in Git.

## Safety Contract

- Give the owner a short pre-action brief before every remote mutation group.
- Never print or commit OAuth tokens, API tokens, R2 keys, `.env`, or `.dev.vars`.
- Do not touch the unrelated R2 buckets `cards`, `mbst1`, or `yakov`.
- Keep the old Pages project available until the Worker hostname is verified.
- Keep `ADMIN_ACCESS_ENABLED=false` until Cloudflare Access is tested.

## Current Production Resources

```txt
Worker:             yakov-viewer
technical URL:      yakov-viewer.jacobjshmol.workers.dev
D1:                 yakov_archive
private R2:         yakov-private-assets
public R2:          yakov-public-assets
OpenNext cache R2:  yakov-next-cache
asset hostname:     assets.yakov.shmol.cc
public hostname:    yakov.shmol.cc (Worker Route yakov.shmol.cc/*)
```

Completed on 2026-07-18:

- D1 migration applied remotely;
- D1 seeded with 9 albums, 312 photos, 312 memberships, and 624 real asset rows;
- foreign-key check passed;
- 624 JPEGs uploaded to public R2, 566.9 MiB total;
- one thumb and one display object passed SHA-256 readback checks;
- OpenNext prerender cache configured and populated in `yakov-next-cache`;
- technical Worker routes return 200, including a real album and health endpoint;
- `assets.yakov.shmol.cc` is active and serves immutable JPEG responses;
- `yakov.shmol.cc/*` is active on Worker version
  `d7e083cb-f4ef-4df3-a7f3-7c5473cc184a`;
- the old Pages custom-domain attachment was removed, while the Pages project was kept
  for rollback;
- production QA passed for `/`, `/albums`, a 36-photo album, and `/api/health`;
- the public index contains 9 real albums, no demo albums, and no localhost media URLs;
- external admin returns 404 and admin API returns 503 while Access is disabled.

## Current Domain Routing

`yakov.shmol.cc` has an externally managed proxied DNS record. Cloudflare therefore
rejects replacing it with a Worker Custom Domain. The production deployment uses the
equivalent Worker Route instead:

```json
"routes": [{ "pattern": "yakov.shmol.cc/*", "zone_name": "shmol.cc" }]
```

The route serves the same OpenNext Worker to visitors while preserving the existing DNS
record. `workers_dev` and preview URLs stay enabled as an independent technical check.

Rollback:

1. Remove or disable the `yakov.shmol.cc/*` Worker Route.
2. Re-add `yakov.shmol.cc` to the existing Pages project.
3. Verify the Pages domain becomes active again.

## Access And Admin

After the public hostname is stable:

1. Create a Cloudflare Access self-hosted application for:
   - `yakov.shmol.cc/admin/*`
   - `yakov.shmol.cc/api/admin/*`
2. Allow only `Jacobjshmol@gmail.com` for the first milestone.
3. Verify the authenticated email header reaches the Worker.
4. Change `ADMIN_ACCESS_ENABLED` to `true`, rebuild types, and deploy.
5. Test archive read, album create, one JPEG upload, private readback, and bin behavior.

## GitHub Workers Builds

The repository remains `rubishelkay/yakov-viewer`. Configure Workers Builds only after
the manual production cutover is healthy:

```txt
production branch:             main
build command:                 npx @opennextjs/cloudflare build
production deploy command:     npx @opennextjs/cloudflare deploy
non-production deploy command: npx @opennextjs/cloudflare upload
root directory:                repository root
```

Before enabling automatic production deploys, push the current branch, review the diff,
merge intentionally, and verify build-time public variables use
`https://assets.yakov.shmol.cc`.

## References

- https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/
- https://developers.cloudflare.com/workers/configuration/routing/custom-domains/
- https://developers.cloudflare.com/workers/ci-cd/builds/
- https://developers.cloudflare.com/d1/reference/migrations/
- https://developers.cloudflare.com/r2/buckets/create-buckets/
- https://developers.cloudflare.com/cloudflare-one/access-controls/policies/app-paths/
