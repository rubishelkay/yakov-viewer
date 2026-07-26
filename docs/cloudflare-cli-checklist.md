# Cloudflare CLI Checklist

This is the current operational rail for Yakov Viewer. Use Wrangler or the Cloudflare
API; do not put credentials, image files, or generated output in Git.

## Safety Contract

- Give the owner a short pre-action brief before every remote mutation group.
- Never print or commit OAuth tokens, API tokens, R2 keys, `.env`, or `.dev.vars`.
- Do not touch the unrelated R2 buckets `cards`, `mbst1`, or `yakov`.
- Keep the old Pages project available until the Worker hostname is verified.
- Keep Cloudflare Access in front of both admin page and API path families while
  `ADMIN_ACCESS_ENABLED=true` enforces the same identity inside the Worker.

## Current Production Resources

```txt
Worker:             yakov-viewer
technical URL:      disabled (`workers_dev=false`)
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
- `yakov.shmol.cc/*` is active on verified upload Worker version
  `dd98686e-673e-41fa-b816-d57cfc4f1131`;
- Cloudflare Access application `Yakov Viewer Admin` protects `/admin`, `/admin/*`,
  `/api/admin`, and `/api/admin/*` with the reusable `Owner only` policy;
- the Access policy allows exactly `Jacobjshmol@gmail.com` and uses the built-in
  Cloudflare identity provider;
- the old Pages custom-domain attachment was removed, while the Pages project was kept
  for rollback;
- production QA passed for `/`, `/albums`, a 36-photo album, and `/api/health`;
- the public index contains 9 real albums, no demo albums, and no localhost media URLs;
- migration `0003_upload_job_photo.sql` is applied; no migrations remain pending and
  the production foreign-key check passes;
- `ADMIN_ACCESS_ENABLED=true`; anonymous admin and admin API requests redirect to the
  correct Access application, while public routes continue to return 200.
- owner OAuth consent completed on 2026-07-22; `/admin/ingest` loads for
  `Jacobjshmol@gmail.com` and a manual archive refresh succeeds through the protected
  production API.
- production smoke upload completed on 2026-07-26: one draft album, one review photo,
  three assets, and one upload job were written through the protected UI;
- private source readback matched the local SHA-256 and bytes; public thumb/display
  returned immutable JPEG responses; the source is not reachable through the public
  asset hostname;
- the accepted public site remains at 9 albums and does not expose the smoke draft.

## Current Domain Routing

`yakov.shmol.cc` has an externally managed proxied DNS record. Cloudflare therefore
rejects replacing it with a Worker Custom Domain. The production deployment uses the
equivalent Worker Route instead:

```json
"routes": [{ "pattern": "yakov.shmol.cc/*", "zone_name": "shmol.cc" }]
```

The route serves the same OpenNext Worker to visitors while preserving the existing DNS
record. `workers_dev` and preview URLs are disabled so admin paths cannot bypass Access
through an alternate Worker hostname.

Rollback:

1. Remove or disable the `yakov.shmol.cc/*` Worker Route.
2. Re-add `yakov.shmol.cc` to the existing Pages project.
3. Verify the Pages domain becomes active again.

## Access And Admin

Access was created on 2026-07-21. Its non-secret runtime identifiers are recorded in
`wrangler.jsonc`; server-side JWT validation is active in production.

Next:

1. Upload a controlled 30-40 JPEG draft album and verify sequential queue behavior,
   order, retry, reload, derivative budgets, and R2/D1 totals.
2. Add Cloudflare edit mutations for album/photo metadata, status, order, covers, tags,
   hide/show, and Bin before using the cloud archive as the public source of truth.

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
