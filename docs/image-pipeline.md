# Image Pipeline

## Current Input

The accepted starting import contains 9 albums and 312 prepared JPEGs around 2000 px.
Typical new admin uploads are also prepared JPEGs around 3-5 MB. The first upload API
accepts JPEG only, with a 20 MiB per-file limit.

Large 30-50 MB originals normally remain in the owner's external archive. A JPEG that
is selected in the Yakov Viewer admin is still preserved unchanged in private R2 so the
site can reprocess it later without another upload.

## Asset Versions

```txt
thumb        public contact-sheet/grid JPEG, target <= 300 KB
display      public album/viewer JPEG, target around 1 MB, API maximum 2 MiB
expanded     optional later high-quality web JPEG, roughly 2-3 MB
downloadJpeg optional later public download, up to roughly 20 MB
sourceJpeg   required private copy of every uploaded JPEG
master       optional future private RAW/RAF/TIFF/panorama
```

The public site uses only `thumb` and `display` today. It never receives private R2
keys, `sourceJpeg`, or `master`. Public download controls remain a later feature.

## Implemented Upload Slice

```txt
selected source JPEG
  -> browser validates JPEG and dimensions
  -> browser creates thumb and display JPEGs
  -> protected Worker verifies MIME, JPEG magic bytes, sizes, and dimensions
  -> Worker writes sourceJpeg to private R2
  -> Worker writes thumb/display to public R2
  -> Worker writes Photo, AlbumPhoto, three Assets, and UploadJob to D1
```

R2 writes happen before the D1 batch. A failed D1 write triggers compensating deletion
of newly written R2 objects. `clientUploadId` makes completed retries idempotent.

Browser canvas output strips source EXIF from public derivatives and gives predictable
web delivery. The private source stays byte-for-byte unchanged, including its embedded
profile and private metadata.

## Storage Policy

Retaining 3,600 source JPEGs at 3-5 MB each would require roughly 11-18 GB before
derivatives. The admin therefore totals all recorded asset bytes and warns at an 8 GiB
working budget. This is not a destructive quota: the owner can prepare smaller sources
or move to paid R2. The uploader never silently drops `sourceJpeg`.

## Color And Metadata

- `thumb` and `display` target predictable sRGB-oriented web output;
- `sourceJpeg` preserves the uploaded bytes and embedded profile;
- public derivatives strip EXIF through browser re-encoding;
- exact GPS and sensitive EXIF are never exposed publicly;
- Display P3 can be evaluated later with explicit fallback tests;
- do not upscale a 2000 px source just to reach a byte target.

## Delivery Rules

- grids load `thumb`, never source or full display unnecessarily;
- album viewer loads `display`;
- width and height are known before render;
- fullscreen fit uses `object-fit: contain` and never crops;
- fixed derivative profiles are used instead of arbitrary user-provided transform sizes;
- private files are streamed only through owner-protected admin routes.

## Future Work

- move derivative processing server-side or to a queue if browser processing becomes a
  consistency or performance problem;
- add `expanded` only when the source contains enough useful detail;
- add optional `downloadJpeg` policy at global, album, and photo level;
- attach selected RAW/RAF/TIFF files as private `master` assets;
- add Google Drive import/synchronization only after the D1/R2 upload path is stable.
