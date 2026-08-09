# Design QA — LogJam compact catalog, continuous feed, and undo iteration

Date: 2026-08-09

## Source truth

- Previous My Edit annotation: `/Users/jacobshmol/Desktop/Screenshot 2026-08-09 at 01.20.37.png`
- Previous catalog annotation: `/var/folders/p6/s6yxnvt551d__p3300w925040000gn/T/TemporaryItems/NSIRD_screencaptureui_bkvhdC/Screenshot 2026-08-09 at 01.22.00.png`
- Current verbal contract: catalog cards have no descriptions or tags; row one contains album title and frame count, row two contains kept/passed progress and `Sorted`; a completed album is noninteractive and omitted with its heading from the continuous sorting feed; `ArrowLeft` passes, `ArrowRight` keeps, and `Z` or `Cmd-Z` safely undoes the latest in-session decision.
- Existing LogJam typography, pure black/white theme tokens, responsive grids, stationary theme toggle, source-album captions, and protected-account flow remain the design-system source.

## Implementation evidence

The following states were captured and inspected in the in-app browser at 1x density:

| State | Viewport |
| --- | --- |
| Compact catalog, dark, one completed album | 1180 × 754 |
| Continuous feed entered through a completed album | 1180 × 754 |
| Compact catalog, one-column mobile | 390 × 844 |
| Compact catalog, supported minimum width | 320 × 700 |
| Continuous feed, mobile | 390 × 844 |
| My Edit, dark, status menu open from the previous iteration | 1134 × 652 |

Local QA uses the nine-album seed and `Local curator`; differences from the annotations in album titles, photographs, identity, and counts are expected content variance.

## Visual comparison

- At 1180 × 754 the catalog remains a three-column grid. Document width and `scrollWidth` are both exactly 1180 px.
- Album subtitles and tags are absent. The first completed card reads as two compact rows: `boring film #57` plus `36 frames`, then `18 kept · 18 passed` plus `Sorted`.
- The completed card is an `ARTICLE`, not a link; the count of `a.album-card--complete` is zero. Its cover remains 50% opaque while title and progress retain full contrast.
- At 390 px, the grid is 362 px wide and document width equals `scrollWidth` at 390 px. The `Sorted` label bounds are `x=321.82…376`.
- At 320 px, the grid is 292 px wide and document width equals `scrollWidth` at 320 px. The `Sorted` label bounds are `x=251.82…306`.
- The mobile continuous feed at 390 px has no horizontal overflow, and its desktop keyboard-shortcut hint is hidden.
- The theme icon retains its 32 × 32 px geometry with computed transform `none`; hover changes only its color to gray.
- My Edit continues to show source-album captions rather than raw photo filenames, and its status menu remains usable by pointer, touch, and keyboard.

## Feed and keyboard interaction checks

- Direct navigation to `/albums/boring-film-57` skips fully sorted `boring film #57`, including its heading, and displays only the next `boring film #59` heading with 35 remaining cards.
- Real Computer Use keyboard input confirmed that modified `Shift+Right` is ignored (`35 → 35`).
- `ArrowRight` kept the active frame and removed it from the feed (`35 → 34`); plain `Z` restored it (`34 → 35`).
- `ArrowLeft` passed the active frame (`35 → 34`); `Cmd-Z` restored it (`34 → 35`).
- After undo, focus returned to the restored `photo-boring-film-59-002` card.
- Undo history is session-local: after one action changed `35 → 34`, navigating away and back left `Z` at 34 rather than undoing an action from the previous feed session.
- The exact local QA decision was then deleted explicitly and the feed returned to its original 35-card state.
- Worker logs showed the decision `PUT` followed by `POST /undo`, both with HTTP 200.
- Browser warning and error logs were empty after desktop, mobile, keyboard, navigation, and undo checks.

## Preserved account and accessibility checks

- Opening the My Edit status menu moves keyboard focus to its menu item without changing `scrollY`; Escape closes it and returns focus to `Change status`.
- The status menu supports pointer changes in both directions and keeps the source-album caption correct after server refreshes.
- Its semantics include `aria-haspopup`, `aria-expanded`, `role=menu`, `role=menuitem`, live announcements, `aria-busy`, focus entry, Escape return, outside-close, and adjacent focus handoff after removal.
- Public cached `/api/public/albums` remains anonymous and unpersonalized. Per-user progress is returned only by the protected, `no-store` private endpoint after the authenticated hint.
- Progress, account data, decisions, and undo stay scoped to the exact Access-authenticated, invited user; published-only reads, parameterized SQL, invitation checks, CSRF validation, CSP, security headers, and rate limits remain intact.
- Conditional undo is versioned, user-scoped, and atomic. A stale competing decision fails with HTTP 409 instead of removing newer state or leaving an active curation inconsistent.
- Archived and source-locked snapshots retain immutable membership during decision reconciliation.
- Production Cloudflare data was not used or modified; all interaction state was confined to local D1.

## Automated verification

- LogJam `pnpm check`: 11 test files, 53 tests, TypeScript, and production Vite build passed.
- Root content validation, TypeScript, lint, and all test suites passed.
- Root `pnpm test:logjam-admin`: 15 D1/admin tests passed.
- The root Next.js production build passed outside the sandbox; the sandbox-only failure was the known loopback `EPERM` restriction.
- `git diff --check`: passed.
- Independent latest-diff reviews found no open P0/P1/P2 findings.

## Findings history

- P2 — authenticated cards could briefly remain links before private progress arrived: fixed with fail-closed loading/error articles, an explicit retry notice, and anonymous fallback only after an authentication failure.
- P2 — two rapid My Edit status changes could race the provider's mutation lock: fixed with an immediate page-level ref guard and disabled status actions until save and refresh finish.
- P2 — the mobile catalog initially widened a 390 px document to 486 px: fixed with shrink-safe `min-width` and `minmax(0, 1fr)` layout rules; both 390 px and 320 px now have exact viewport-width scroll geometry.
- P2 — the whole completed link was initially dimmed, reducing text contrast: fixed by applying 50% opacity to the cover only, keeping metadata opaque, and rendering the completed card as a noninteractive article.
- P2 — the ARIA status menu initially left focus on its trigger: fixed with focus entry using `preventScroll` and Escape return.
- P2 — the 154 px status popup clipped at 320 px: fixed with a bounded narrow-layout width and right offset.
- P2 — raw photo title remained in image alternative text: removed in favor of source-album wording.
- P2 — a shared canonical photo could be mislabeled with only its first album: fixed by returning all published source-album titles in deterministic order.
- P2 — Keep → Pass or undo could leave editable curation counts inconsistent: fixed with versioned atomic reconciliation while preserving immutable memberships.
- P0/P1/P2 open findings: none.

final result: passed
