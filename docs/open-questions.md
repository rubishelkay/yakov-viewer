# Open Questions

These are the current questions to resolve before implementing the admin/backend phase.

## Sets And Tags

1. Should public sets be edited only manually, or can the admin later auto-build sets from tag queries?
2. Should set layout modes be chosen per set: hero, album grid, editorial row, compact?
3. Should the public interface show set labels only when needed, keeping navigation mostly visual and minimal?
4. Should album tags and photo tags share one dictionary table with different scopes, or use two separate dictionaries?
5. Should photo tags be visible publicly, or admin-only in the first version?

## Albums

1. Should an album belong to at least one set, or can it be unassigned until published?
2. Should album URLs include set slugs, or stay stable as `/albums/[album]`?
3. Should published albums appear automatically on the public album index, or can an album be published but excluded from the public index?

## Photos

1. Should individual photos inherit public download/open permissions from the album by default?
2. Should hidden photos keep public R2 files in place for the first version?
3. Should any public large-file URLs be stable, or should larger files always be generated through a Worker route for future revocation?
4. Should the public all-photos archive use inherited album tags plus direct photo tags for filtering?

## Covers

1. Should the default landscape cover be the first photo in the album?
2. Should square covers be generated from the landscape crop by default?
3. Should portrait covers be optional and separately selected/cropped?
4. Should uploaded standalone cover files be stored as regular photos or separate cover-only assets?

## Admin

1. Should the first admin live under `/admin` in this repo, with the option to split later?
2. Is Cloudflare Access enough for the first private admin login?
3. Should delete use a 7-day trash period by default?
4. Should the admin support bulk metadata edits in the first version?
5. Should the admin show compact storage totals per album from the first version?
6. Should global media settings be editable from the first admin version?

## Image Processing

1. Which processing engine should be used first: Cloudflare Images/Workers where possible, or an external/local processing job?
2. Should `thumb` and `display` always be sRGB?
3. Should uploaded source JPEGs always preserve embedded color profiles?
4. Should public derivatives strip all EXIF or preserve a small whitelist?
5. Should public download default to `expanded` or `downloadJpeg`?
