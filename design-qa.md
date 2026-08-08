# Design QA — LogJam frontend iteration

Date: 2026-08-08

## Source truth

- Catalog annotation: `/var/folders/p6/s6yxnvt551d__p3300w925040000gn/T/TemporaryItems/NSIRD_screencaptureui_lp25Ml/Screenshot 2026-08-08 at 13.58.52.png`
- Album-feed annotation: `/var/folders/p6/s6yxnvt551d__p3300w925040000gn/T/TemporaryItems/NSIRD_screencaptureui_WClOjH/Screenshot 2026-08-08 at 13.58.59.png`
- Verbal contract: pure white/black themes, system default on first visit, one two-state icon beside the wordmark, one photo count, smaller album title, natural-aspect photos without letterboxing or visible titles, compact centered Pass/Keep links, and animated removal after every decision.

## Implementation evidence

| State | Viewport / density | Local artifact |
| --- | --- | --- |
| Catalog, light, focused | 1096 × 664 / 1x | `/tmp/logjam-catalog-final-light-1096x664.png` |
| Catalog, light, full page | 1096 × 1671 / 1x | `/tmp/logjam-catalog-full-light-1096.png` |
| Catalog, dark | 1096 × 664 / 1x | `/tmp/logjam-catalog-dark-1096x664.png` |
| Album photo, light, focused | 985 × 712 / 1x | `/tmp/logjam-album-light-985x712.png` |
| Catalog, mobile | 390 × 844 / 1x | `/tmp/logjam-catalog-mobile-390x844.png` |
| Album feed, mobile | 390 × 844 / 1x | `/tmp/logjam-album-mobile-390x844.png` |
| Keep transition | 985 × 712 / 1x | `/tmp/logjam-keep-animation-985x712.png` |

The in-app browser's full-page capture scales the page content differently from its viewport capture. Pixel comparison therefore used the focused screenshots at the exact reference sizes; the full-page artifact was used only for structural coverage. DOM measurements and responsive screenshots were used for layout assertions.

## Comparison loops

1. Captured both annotated screenshots at original resolution and inspected the existing LogJam components and styles.
2. Implemented the requested theme, catalog, photo-frame, action, swipe, and collapse changes.
3. Compared each source screenshot beside its same-size implementation screenshot in one visual inspection. The requested deletions are absent: no beige page surface, duplicate synthesized count, black media box, visible photo title, or large colored decision buttons.
4. Checked desktop light/dark and mobile light/dark. The catalog resolves to three columns at 1096 px, one column at 390 px, and has no horizontal overflow.
5. Rebuilt after the CSP-safe external theme initializer and ran a clean browser tab. No current console errors or warnings remained.

The photographs and album names differ between the supplied screenshots and local QA because the local preview uses the committed nine-album seed. This is expected content variance, not a visual regression.

## Measured visual checks

- Light page background: `rgb(255, 255, 255)`.
- Dark page background: `rgb(0, 0, 0)`.
- Catalog album title: 20 px at 1096 px viewport; only subtitle plus one `frames` count render.
- Album image rendered ratio matched its intrinsic ratio within rounding (`1.4948` vs `1.4944`).
- Album gesture surface is transparent; visible photo-title element is absent.
- Pass and Keep are centered, borderless text controls.
- Mobile document width equals viewport width: 390 px.

## Interaction and persistence checks

- First Pass exercised the local auth replay path: visible cards `36 → 35`; the decided image disappeared.
- Direct Keep: `35 → 34`; the card moved right, collapsed, and the next card rose.
- Actual right swipe: `34 → 33`.
- Actual left swipe: `33 → 32`.
- Vertical drag: `32 → 32`; no accidental decision.
- My Edit checkpoint: `Kept 2`, `Passed 2`; both grids showed two photos.
- Reload preserved the My Edit counts; revisiting the album kept all four decided photos absent.
- Sequential keyboard sorting after focus handoff: `31 → 30 → 29`; focus remained on the next `.photo-card__gesture` after both decisions.
- Theme toggle changed the document and accessible label in both directions; explicit choice survived reload. Pure system-default resolution is also covered by unit tests.
- Final clean browser tab: zero current console errors or warnings.

## Security and repository checks

- Theme initialization is a same-origin external script, compatible with the unchanged `script-src 'self'` CSP; no `unsafe-inline` script exception was added.
- Final local response retained CSP, frame denial, permissions policy, no-sniff, referrer policy, and `noindex` headers.
- Backend, D1 schema, Access validation, rate limits, and production data were not changed.
- `pnpm check`: passed, 34 tests.
- `git diff --check`: passed.

## Findings history

- P1 — decided card remained in the feed: fixed with save-aware exit and collapse states.
- P1 — keyboard focus was lost after dismissal: fixed with next-card focus handoff and a persistent live region.
- P1 — inline pre-paint theme script conflicted with the strict CSP: fixed by moving it to `/theme-init.js` without weakening headers.
- P2 — mobile flex gap would have caused a final jump after removal: fixed by moving spacing inside the collapsing card.
- P0/P1/P2 open findings: none.

final result: passed
