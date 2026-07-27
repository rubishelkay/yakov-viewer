# Image Pipeline

## Current Contract

The production upload path accepts prepared JPEG files only. A normal input is roughly
2000 px and 3-5 MB; the hard request limit is 20 MiB.

One upload creates three public R2 objects:

```txt
thumb     contact sheets and album cards, max 640 px, target <= 300 KB
display   normal album viewer, max 2000 px, target around 1 MB, API max 2 MiB
expanded  sanitized uploaded JPEG, max 20 MiB
```

The uploaded JPEG is the `expanded` web tier. It is not duplicated as a private
`sourceJpeg`. Full 20-50 MB originals, RAW/RAF/TIFF files, and scans remain in the
owner's Google Drive archive for now. The `sourceJpeg` and `master` enum values remain
reserved for a later private archive integration.

## Upload Flow

```txt
admin selects one or many JPEGs
  -> browser decodes dimensions and EXIF orientation
  -> browser creates sRGB thumb and display JPEGs
  -> browser losslessly removes unsafe metadata from expanded JPEG
  -> orientation != 1 is normalized by a full-size browser re-encode
  -> protected Worker validates MIME, JPEG signatures, byte limits, and dimensions
  -> Worker rejects expanded JPEGs that still contain unsafe metadata
  -> Worker writes thumb/display/expanded to yakov-public-assets
  -> Worker writes Photo, AlbumPhoto, three Asset rows, and UploadJob to D1
```

R2 writes happen before the D1 batch. A failed database write triggers compensating
deletion of newly written objects. A stable `clientUploadId` makes a completed retry
idempotent.

Batch files are processed sequentially to keep browser memory predictable. A bad file is
marked failed without cancelling the remaining files.

Each successful file is committed independently. If the browser, network, or Worker
interrupts a batch, completed photos remain valid in D1/R2 and only missing frames need
to be selected again. The admin refreshes its archive snapshot after the batch finishes.

## Metadata And Color

Public JPEGs never retain EXIF, XMP, IPTC/Photoshop, comments, or unknown APP metadata.
JFIF, ICC profile segments, and Adobe JPEG markers are preserved when the expanded
file can be sanitized without re-encoding. The browser-generated `thumb` and `display`
tiers are normalized to sRGB.

This prevents GPS and sensitive camera metadata from reaching public R2 while avoiding
an unnecessary second lossy encode of a normally oriented expanded JPEG.

## Public Delivery

- grids and cards load `thumb`;
- ordinary viewer mode loads `display`;
- the viewer `+` action lazy-loads `expanded`;
- all viewer modes preserve the complete frame and never crop it;
- `Allow JPEG download` is an album-level policy;
- when enabled, Download streams the same expanded object through a public Worker route
  with an attachment filename;
- when disabled, the download route returns 404, but `+` still works.

Every public query requires both the album and photo to be `published`. Hidden, draft,
review, Bin, and deleted records do not render publicly.

## Future Extensions

- optional private `master` attachments from Google Drive;
- optional separate `downloadJpeg` when download and expanded should diverge;
- server/queue derivative processing if browser processing becomes inconsistent;
- crop-specific cover assets;
- selected collaborator access to private masters.

No future extension should require changing the canonical `Photo`, `AlbumPhoto`, or
`Asset` relationships.
