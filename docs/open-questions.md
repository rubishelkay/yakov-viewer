# Open Questions

These are the current questions to resolve before implementing the admin/backend phase.

## Recently Resolved

1. Keep one main Codex chat/workstream until the first real R2/D1 upload works end to end.
2. Polish the local admin UX before wiring Cloudflare storage.
3. First real upload accepts JPEG only; RAW/RAF/TIFF stays modeled as future private `master` assets.
4. Demo/fake albums can remain as development fixtures and be deleted later from the admin.
5. Codex should prepare exact Cloudflare setup steps first; the owner may create resources manually if MCP/API automation is unreliable.
6. The accepted Fable frontend is the public visual source of truth; no Figma pass is required before integration.
7. Its 9 albums and 312 photos are real starting content and will be imported to D1/R2 without committing media to Git.
8. Homepage content is driven by admin-managed sets.
9. Deploy the combined Next.js app through Cloudflare Workers/OpenNext rather than keeping static Pages as the long-term architecture.
10. A canonical photo may belong to multiple albums through `AlbumPhoto` membership rows.
11. The first integrated public frontend stays intentionally minimal; All Photos and public downloads come later.
12. Typical uploads are 2000 px JPEGs around 3-5 MB; targets are thumb <=300 KB and display around 1 MB.
13. A photo inherits effective public tags from every published album membership, plus its direct photo tags.
14. Every admin-uploaded JPEG is preserved unchanged as a private `sourceJpeg`.
15. Sets use one ordered album-rail presentation; the old per-set layout picker is removed.
16. Initial admin identity uses Cloudflare's built-in account IdP and exact owner email.
17. The current public route set is `/`, `/albums`, `/albums/[slug]`, `/tags/[slug]`, and `/about`.

## Sets And Tags

1. Should public sets be edited only manually, or can the admin later auto-build sets from tag queries?
2. Should the public interface show set labels only when needed, keeping navigation mostly visual and minimal?
3. Should photo tags be visible publicly, or admin-only in the first version?

## Albums

1. Should an album belong to at least one set, or can it be unassigned until published?
2. Should album URLs include set slugs, or stay stable as `/albums/[album]`?
3. Should published albums appear automatically on the public album index, or can an album be published but excluded from the public index?

## Photos

1. Should hidden photos keep public R2 derivative objects in place for the first version, relying on API visibility, or should public delivery require signed/Worker URLs?
2. Should any future public large-file URLs be stable, or should larger files always be served through a Worker route for revocation?

## Covers

1. Should the default landscape cover be the first photo in the album?
2. Should square covers be generated from the landscape crop by default?
3. Should portrait covers be optional and separately selected/cropped?
4. Should uploaded standalone cover files be stored as regular photos or separate cover-only assets?

## Admin

1. Should the first admin live under `/admin` in this repo, with the option to split later?
2. Is Cloudflare Access enough for the first private admin login?
3. Should delete use a 7-day trash period by default?
4. What minimum bulk workflow is required before real upload: one album at a time, or creating/uploading several albums in a single session?
5. Should the admin support bulk metadata edits before Cloudflare upload, or immediately after the first real upload milestone?
6. Should the admin show compact storage totals per album from the first Cloudflare milestone, or only after derivative generation is stable?
7. Should global media settings be editable from the first admin version?

## Image Processing

1. Which processing engine should be used first: Cloudflare Images/Workers where possible, or an external/local processing job?
2. Should `thumb` and `display` always be sRGB?
3. Should uploaded source JPEGs always preserve embedded color profiles?
4. Should public derivatives strip all EXIF or preserve a small whitelist?
5. Which processing engine should create stored derivatives in the first real upload milestone while preserving predictable color?
