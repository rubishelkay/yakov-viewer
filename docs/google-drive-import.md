# Google Drive Import

## Goal

Most photo uploads may come from Google Drive folders containing full albums. The admin should support importing a Drive folder into an album.

This is important, but it does not need to block the first working upload MVP. Local drag-and-drop to R2 can ship first, with Google Drive import marked as the next upload source.

## Desired UX

```txt
Admin -> Albums -> New album
  -> Import from Google Drive
  -> paste/select folder
  -> preview files
  -> confirm title/tags/sets
  -> import
  -> process derivatives
  -> review album
```

## Development Vs Production

During Codex development, the connected Google Drive account can help inspect and test folder-based workflows.

Production cannot depend on the local Codex connector. It needs one of:

- Google OAuth for the owner/admin;
- a service account with access to chosen folders;
- manual download/upload fallback for early testing.

OAuth is likely the best long-term fit because the owner can authorize access to their Drive and paste folder links.

## Import Rules

Target version:

- JPEG only;
- ignore unsupported files;
- preserve Drive folder order where possible;
- otherwise sort by filename;
- create one album per imported folder by default;
- source JPEG goes to private R2;
- derivatives go to public R2;
- metadata goes to D1;
- album lands in draft/review.

First MVP fallback:

- local drag-and-drop JPEG upload;
- Google Drive import UI can be present as disabled/planned;
- production Google auth is implemented after the R2/D1 upload path works.

## Open Risks

- Google Drive folder order may not be stable or meaningful through API.
- Large folders need pagination and retry.
- Import must handle duplicate filenames.
- Import should avoid re-importing already imported files unless explicitly requested.
- Production Google auth setup must not expose tokens in GitHub.
