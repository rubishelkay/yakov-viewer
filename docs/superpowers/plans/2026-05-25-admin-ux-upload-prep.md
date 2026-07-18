# Admin UX And Upload Prep Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prepare Yakov Viewer for the first real Cloudflare-backed JPEG upload by finishing the local admin UX and freezing the shared archive contract.

**Architecture:** Keep the admin local-first until the UX can handle realistic album work. Then preserve the same UI actions while replacing the local repository adapter with Cloudflare Pages Functions backed by D1/R2. RAW/RAF/TIFF remains a modeled private `master` asset path, not part of the first upload implementation.

**Tech Stack:** Next.js App Router, React, TypeScript, localStorage, IndexedDB, Zod, Cloudflare Pages Functions, D1, R2.

---

### Task 1: Admin UX Sanity Pass

**Files:**
- Inspect: `src/components/admin/AlbumWorkspace.tsx`
- Inspect: `src/components/admin/SetWorkspace.tsx`
- Inspect: `src/components/admin/PhotoLibraryWorkspace.tsx`
- Inspect: `src/components/admin/AdminDashboard.tsx`
- Inspect: `src/styles/admin.css`
- Modify only if needed: the same files above

- [ ] **Step 1: Review current admin flows without Cloudflare**

Run the local app only when the user asks to test visually:

```bash
pnpm dev
```

Manual routes to inspect:

```txt
http://localhost:3000/admin
http://localhost:3000/admin/albums
http://localhost:3000/admin/sets
http://localhost:3000/admin/photos
http://localhost:3000/admin/tags
http://localhost:3000/admin/settings
http://localhost:3000/admin/bin
```

Expected: admin opens without public header/footer, local state persists, and no control looks active if it has no behavior.

- [ ] **Step 2: Test realistic album density**

Use the existing seeded large album, currently represented in `src/admin/mock-data.ts`, and confirm a 30-40 photo album is usable.

Expected:

```txt
photo grid scans quickly
selected photo inspector carries detailed controls
hidden photos are visually quieter
delete/bin actions are not visually dominant
tag inputs use search/autocomplete, not huge checkbox lists
```

- [ ] **Step 3: Fix only the highest-friction UX issues**

Make small focused edits if the review finds obvious friction. Keep the scope to admin UI polish and avoid new backend abstractions.

Expected:

```txt
no decorative controls
no large nested cards in dense admin views
no grids loading source-sized images
no forced vertical thumbnails for mostly horizontal photo sets
```

- [ ] **Step 4: Verify**

Run:

```bash
pnpm check
```

Expected: content validation, typecheck, lint, and static build all pass.

### Task 2: Freeze Shared Archive Contract

**Files:**
- Inspect: `src/admin/archive-schema.ts`
- Inspect: `src/admin/admin-state.tsx`
- Inspect: `src/admin/api-contract.ts`
- Inspect: `migrations/0001_archive.sql`
- Inspect: `docs/admin-api-contract.md`
- Inspect: `docs/content-model.md`
- Modify only if names or fields drift between these files

- [ ] **Step 1: Compare TypeScript schema to D1 migration**

Check that these concepts use consistent names:

```txt
Set
Album
Photo
Asset
Tag
Collection
UploadJob
AdminSettings
Trash/Bin item
```

Expected: no field exists only in UI if it should persist in D1.

- [ ] **Step 2: Confirm asset version model**

Confirm that assets can represent:

```txt
thumb
display
expanded
downloadJpeg
sourceJpeg
master
```

Expected: JPEG upload can ship first, while `master` can later point to RAW/RAF/TIFF/private panorama files.

- [ ] **Step 3: Confirm many-to-many needs**

Check that the model leaves room for:

```txt
one album in multiple sets
one photo referenced by collections
future curated photo selections without file duplication
```

Expected: no need to duplicate image files for selected-work albums or collections.

- [ ] **Step 4: Update docs after contract changes**

If any schema or migration names change, update:

```txt
docs/admin-api-contract.md
docs/content-model.md
docs/image-pipeline.md
```

Expected: docs, TypeScript, and D1 migration use the same language.

### Task 3: Cloudflare Setup Checklist

**Files:**
- Inspect: `docs/cloudflare-setup.md`
- Inspect: `docs/cloudflare-github-setup-plan.md`
- Inspect: `wrangler.example.toml`
- Modify: `docs/cloudflare-setup.md`
- Modify: `wrangler.example.toml` only for non-secret binding names

- [ ] **Step 1: Write exact owner checklist**

Document the resources the owner must create or confirm:

```txt
R2 private bucket
R2 public bucket
D1 database
Cloudflare Access app for /admin
Pages project build command: pnpm build
Pages output directory: out
custom domain: yakov.shmol.cc
asset domain: assets.yakov.shmol.cc
```

Expected: no secret values appear in docs.

- [ ] **Step 2: Confirm binding names**

Keep binding names stable and non-secret:

```txt
YAKOV_ARCHIVE_DB
YAKOV_PUBLIC_ASSETS
YAKOV_PRIVATE_ASSETS
```

Expected: code and docs can refer to bindings without exposing credentials.

- [ ] **Step 3: Decide manual-first setup**

Before using Cloudflare MCP/API for resource creation, give the user a short brief and ask for confirmation.

Expected:

```txt
no accidental Cloudflare resource mutation
no token/key committed
no domain change without confirmation
```

### Task 4: First Real JPEG Upload Slice

**Files:**
- Inspect: `functions/api/admin/uploads/sign.js`
- Inspect: `functions/api/admin/albums.js`
- Inspect: `functions/api/admin/archive.js`
- Inspect: `src/admin/api-contract.ts`
- Modify after UX/contract approval: the same files above

- [ ] **Step 1: Keep API slice small**

Implement only:

```txt
create album metadata
request signed JPEG upload target
store source JPEG in private R2
write photo/asset records in D1
reload admin archive from API
```

Expected: one photo upload works before batch processing is generalized.

- [ ] **Step 2: Keep derivatives simple**

For the first slice, register placeholder derivative records or generate the smallest required web preview only.

Expected: avoid blocking on the full image pipeline before proving R2/D1 round trip.

- [ ] **Step 3: Verify security**

Run:

```bash
pnpm check
git status -sb
```

Also check:

```txt
no .env
no API tokens
no R2 keys
no original uploads
no RAW/TIFF
no generated derivatives
no .next or out
```

Expected: the branch is safe to push.

### Task 5: Next Decision Gate

**Files:**
- Modify: `docs/working-rails.md`
- Modify: `docs/open-questions.md`

- [ ] **Step 1: Review what worked**

After the first real upload, record:

```txt
what was easy
what was slow
what broke in Cloudflare
what the admin UI made confusing
```

- [ ] **Step 2: Decide whether to split workstreams**

If the upload milestone works, decide whether a second backend/Cloudflare chat is useful.

Expected recommendation:

```txt
stay one chat if most work is still product/UX
split only if backend work becomes a separate queue of D1/R2/Queues/Access tasks
```
