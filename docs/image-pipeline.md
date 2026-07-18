# Image Pipeline

## Confirmed Baseline

The accepted frontend source contains 9 real albums and 312 real photos. Its prepared JPEGs are around 2000 pixels, average about 1.6 MB, and are suitable as the first public `expanded`-quality import. They must be imported to R2, not copied into this repository.

Typical future admin uploads will also be web-prepared JPEGs around 2000 pixels and 3-5 MB. Full 30-50 MB originals normally stay outside Cloudflare, for example on Google Drive. The model still supports optional larger JPEG and RAW/TIFF masters later.

Images are represented in typed content with:

- stable `id` and `slug`;
- `width`, `height`, and `aspectRatio`;
- public `alt`;
- moderate metadata;
- `visibility`;
- R2 `assetBaseUrl` and `originalKey`;
- `rights.downloadAllowed` and optional `downloadUrl`.

The current public content model is temporary. The integration phase replaces the single original image reference with explicit asset versions backed by the shared archive model.

## Temporary Local Admin Preview Cache

During local admin design/testing, seed thumbnails are generated into:

```txt
public/_admin-previews/
```

This folder is ignored by git on purpose. It is a disposable cache for the current R2 seed photos, created by:

```txt
pnpm admin:preview-cache
```

The admin UI uses these local preview JPEGs for album lists, contact sheets, set previews, and dashboard strips. The selected-photo inspector still loads the larger display asset only after a photo is selected.

This temporary cache exists only so local testing does not keep downloading large R2 originals over mobile internet. When the real Cloudflare R2/D1 image pipeline is connected, this folder and script can be removed or replaced by production `thumb`/`display` asset records.

## Target Asset Versions

Each photo should eventually support these asset levels:

```txt
thumb
display
expanded
downloadJpeg
sourceJpeg
master
```

Confirmed working targets:

- `thumb`: public preview, target up to 300 KB;
- `display`: public viewing image, target around 1 MB;
- `expanded`: public high-quality viewing image, target around 2-3 MB when the source contains enough data;
- `downloadJpeg`: optional future public download/open file, allowed up to about 20 MB;
- `sourceJpeg`: uploaded JPEG, commonly around 2000 px and 3-5 MB, private/admin by default;
- `master`: optional private RAW/RAF/TIFF/full panorama, stored only for selected photos.

The uploaded `sourceJpeg` should be stored as uploaded unless the admin explicitly requests normalization. It is the main high-quality archive asset for the admin, not something the public site should casually load.

The master file is private in the current product phase. Later, selected master downloads can be added for approved users.

The first integrated public frontend does not add a download control. Public download/open access remains modeled for a later iteration and should use `downloadJpeg` or `expanded`, never expose `master` by accident.

## First Upload Slice

The first tested Cloudflare-backed uploader stores exactly one asset version:

```txt
sourceJpeg -> private R2, preserved byte-for-byte
```

It records the canonical photo, album membership, private asset, and upload job in D1.
It does not create placeholder `thumb`, `display`, or `expanded` rows. Those versions
will be added only when the derivative processor writes real files to public R2.

The initial Worker endpoint accepts JPEG files up to 20 MiB. That limit covers the
current expected 3-5 MB uploads and can be revisited before large source JPEG or master
uploads. RAW/RAF/TIFF remains represented by `master` in the model but is not accepted
by this endpoint.

Do not upscale or inflate a 2000 px upload merely to hit a byte target. Targets are upper guidance, not required file sizes.

## Color And Metadata Policy

For the first production pipeline:

- `thumb` and `display` should be generated for web consistency, preferably in sRGB;
- `expanded` should be optimized for high-quality browser viewing;
- `downloadJpeg` should be generated only when public download/open access is enabled;
- `sourceJpeg` should preserve the uploaded file and embedded color profile where possible;
- exact GPS should not be exposed publicly;
- sensitive EXIF should be stripped from public derivatives;
- the admin may retain technical metadata privately.

Future advanced settings can support:

```txt
webColorProfile: srgb | preserve
sourceJpegPolicy: preserve | normalize
```

`sRGB` is the safest web default. `Display P3` can show a wider color range on modern Apple and high-end displays, but it requires a careful pipeline and fallback strategy. The first version should prioritize predictable color over clever color management.

## Responsive Delivery

`src/lib/images.ts` defines fixed width sets:

- `thumb`: 320, 480, 640;
- `grid`: 480, 800, 1200;
- `detail`: 1200, 1600, 2400;
- `hero`: 1200, 1600, 2400, 3200.

In production builds, image URLs use Cloudflare's `/cdn-cgi/image/...` transformation format through `NEXT_PUBLIC_IMAGE_TRANSFORM_BASE_URL`. Development falls back to raw seed URLs so local browser checks still render images.

In the next phase, the responsive layer should prefer pre-generated `thumb` and `display` assets instead of using the large JPEG for every transformation source. Cloudflare transformations can still be used for final responsive widths, but the source should be an appropriate web asset when possible.

## Upload Processing

Target processing flow:

```txt
uploaded large JPEG
  -> store sourceJpeg privately
  -> generate thumb
  -> generate display
  -> generate expanded public preview only when useful
  -> generate downloadJpeg if configured
  -> generate cover crops when selected
  -> extract dimensions/color metadata
  -> strip public sensitive metadata
  -> write asset records
```

RAW/RAF/TIFF ingestion is a later phase. The data model should allow it, but the first admin should focus on large JPEG uploads.

Google Drive remains an external originals archive for now. Automatic Drive synchronization is explicitly out of scope until the R2/D1 upload path is stable.

## Rules

- Do not load originals in grids.
- Do not generate unbounded widths.
- Do not publish GPS EXIF by default.
- Uploaded source JPEG download/open access is private by default.
- Larger public download/open access can be enabled globally, at album level, or at photo level, but should use optimized derivatives in the first version.
- Master downloads are private and disabled in the current phase.
- Future ingest scripts should strip sensitive EXIF, compute dimensions, generate blur/dominant color data, and upload to R2.
