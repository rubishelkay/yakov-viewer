# LogJam

An isolated Cloudflare Worker + Vite/React application for `logjam.shmol.cc`. It reads the published portfolio from the existing `yakov_archive` D1 database and stores collaboration state only in `logjam_*` tables.

The main portfolio frontend, `archive_*` records, R2 objects, Sets and downloads are never mutated by this application.

## Product surface

- Public, unique published-album catalog: three columns on desktop, one on mobile; no Selected Films and no photo hero.
- A continuous one-column photo feed. The next album is appended with `IntersectionObserver` without changing browser history, so Back returns to the catalog.
- Horizontal, axis-locked decisions: left = pass, right = keep. Native vertical scrolling remains available; buttons and arrow keys provide accessible alternatives.
- Anonymous browsing. The first write stores the pending decision, enters `/auth/start`, and retries the idempotent write after Cloudflare Access.
- Global keep/pass per canonical photo, independent of album membership.
- Private account with kept, passed and up to 20 curations; each curation accepts up to 500 kept, published photos from any album.
- Reorderable draft curations and immutable versioned submissions. Submission does not freeze the working draft. A curation becomes permanently read-only after one of its promoted archive albums is published for the first time; hiding or purging that album does not reopen it.

## Boundaries and safeguards

- Worker re-verifies the Access JWT issuer and the LogJam application AUD; Access being configured at the edge is not treated as sufficient by itself.
- A verified Access identity is authorized against `logjam_invites` in D1 on every `/auth/start*` and `/api/private*` request before a user record is created or read. Removing an email therefore revokes application access on the next request without deleting that curator's work.
- Production fails closed. The local identity bypass requires the exact local-only tuple documented in `.dev.vars.example`; a production bypass flag returns `503`.
- Every private query is scoped to the signed-in `logjam_users.id`. Unknown or other-user curation IDs return `404`.
- All mutations require same-origin `Origin` and `application/json`.
- Decision writes use the `DECISION_RATE_LIMITER` binding at 120 attempts/minute per verified identity; all other private mutations use a separate 60/minute limiter. Both run before user synchronization. They are abuse guards (Cloudflare rate limiting is per location), not billing/accounting state.
- Existing-user `last_seen_at` is coalesced to at most one write per ten minutes, so repeated private reads do not create a D1 write per request.
- Request bodies are capped at 64 KiB; IDs and titles are bounded. Storage is capped at 20 total curations, 500 photos per curation, 20 immutable submissions per curation and 50 immutable submissions per account; archived records count toward the caps.
- Public reads require published albums and photos, public assets and D1 `public_url`. The app never derives or exposes R2 object keys.

## Local development

Requirements: Node 20+ and a local D1 database containing the root migrations through `0007_logjam_invites.sql`.

1. Install this app independently:

   ```sh
   cd logjam
   pnpm install
   ```

2. Copy `.dev.vars.example` to the ignored `.dev.vars`; keep the explicit local bypass values for local work. The shared, non-secret D1 ID, Access team domain, and LogJam Access AUD are committed in `wrangler.jsonc`.

3. Apply the shared root migrations to local D1 using Wrangler and this config:

   ```sh
   npx wrangler d1 migrations apply yakov_archive --local --config wrangler.jsonc
   ```

4. For the closest production-shaped run:

   ```sh
   pnpm run build
   pnpm run dev:worker
   ```

   Open `http://127.0.0.1:8787`. For Vite HMR, keep `dev:worker` running in one terminal and run `pnpm run dev` in another; Vite serves port `5174` and proxies `/api` and `/auth` to the Worker.

Checks:

```sh
pnpm run typecheck
pnpm test
pnpm run build
```

## One-time Cloudflare setup

Production checkpoint on 2026-08-05:

- Cloudflare One-time PIN is enabled.
- The self-hosted Access application `Yakov LogJam` protects only `/auth/start`, `/auth/start/*`, `/api/private`, and `/api/private/*` on `logjam.shmol.cc`.
- Its 24-hour Allow policy accepts only One-time PIN, and the exact application AUD is committed in `wrangler.jsonc` for Worker-side JWT validation.
- The public `/` and `/api/public/*` routes remain outside Access.
- GitHub-triggered Workers Builds is connected to `rubishelkay/yakov-viewer` with production branch `codex/logjam`, root directory `/logjam`, and non-production builds disabled. The build runs `pnpm check`; only after it passes, the deploy command applies pending D1 migrations through Wrangler and deploys `yakov-logjam` with its custom domain.
- Cloudflare's automatic setup probe used the repository default branch `main` and stopped at "root directory not found" before running the build or deploy command. It did not touch production D1; the next production-branch push starts the real guarded deployment.

Before the first deploy:

1. Apply the pending shared migrations `../migrations/0006_logjam.sql` and `../migrations/0007_logjam_invites.sql` to the existing production `yakov_archive` D1 database.
2. Confirm the committed shared D1 ID and choose a positive, deployment-unique rate-limit `namespace_id` in `wrangler.jsonc`.
3. In Cloudflare Zero Trust, create one self-hosted Access application covering only these paths on `logjam.shmol.cc`:
   - `/auth/start`
   - `/auth/start/*`
   - `/api/private`
   - `/api/private/*`

   Keep `/` and `/api/public/*` outside Access. Enable One-time PIN and require it in the Allow policy. Access proves control of the email address; the Worker then performs the invite authorization from D1. One Access application may contain all four path entries and therefore one AUD; if they are separate Access applications, set `ACCESS_APP_AUD` to the exact audience tags separated by a comma.
4. Set `ACCESS_TEAM_DOMAIN` to the account team domain and `ACCESS_APP_AUD` to the exact LogJam audience tag(s). Do not set any `LOCAL_AUTH_*` variables in production.
5. Review the Custom Domain entry. `routes[].custom_domain=true` lets the Worker deployment provision the `logjam.shmol.cc` DNS record and certificate; `workers_dev` and preview URLs are disabled.
6. Build, verify, then deploy from this directory with `pnpm run deploy` when explicitly ready.

The owner manages the D1 invitation list in `/admin/logjam`. The first version does not send invitation mail: add the address, then share `https://logjam.shmol.cc` manually. Adding Facebook or a separate auth service is unnecessary for the initial 5–10 curators; any invited Gmail or other email address can receive a one-time PIN.

## API map

Public:

- `GET /api/public/albums`
- `GET /api/public/albums/:slug`

Access-protected and independently verified:

- `GET /api/private/session`
- `GET /api/private/account`
- `PUT /api/private/decisions/:photoId`
- `POST /api/private/curations`
- `GET|PATCH|DELETE /api/private/curations/:id`
- `POST /api/private/curations/:id/submit`

`/auth/start?returnTo=/local/path` accepts only same-origin relative return paths.
