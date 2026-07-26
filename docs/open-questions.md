# Open Questions

The production archive/admin contract is now decided. These items are intentionally
deferred and do not block real album uploads.

## Near-Term Product Questions

1. Does regular use need bulk status/tag edits across several albums?
2. Should `/albums` gain search or multi-tag filtering before 50 albums?
3. Should unpublished albums be visually grouped separately in the admin list?
4. Is 7-day Bin retention sufficient, or should purge remain manual indefinitely?
5. Should a Set eventually have multiple public layout modes again, or keep one rail?

## Media And Archive

1. Should Google Drive masters be linked by file ID, imported on demand, or synchronized?
2. When should `downloadJpeg` become separate from `expanded`?
3. Is browser JPEG processing consistent enough after real Safari upload sessions, or
   should Cloudflare Queue/server processing replace it?
4. Should selected files preserve Display P3 for web output after cross-browser tests?
5. Which metadata fields should be explicitly entered in D1 instead of read from EXIF?

## Future Shared Platform

1. What collection model does Logjamming need beyond AlbumPhoto membership?
2. When are collaborator roles and selected private downloads needed?
3. Should the admin eventually become a separate application/repository?

Resolved decisions belong in `docs/project-decisions-ru.md`, not in this list.
