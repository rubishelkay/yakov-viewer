# Content Model

## Core Structure

The archive should use this hierarchy:

```txt
Set
  Album
    Photo
      Asset versions

Collection
  Selected photos from many albums

All Photos Archive
  Published photos filtered by effective tags
```

The main entity is the album. An album is similar to a folder or a roll of film: for example, `Film 060` with 36 frames, or a digital shoot with 30 selected files.

Sets are large public/editorial sections made from albums. On the homepage, a set can behave like one screen or one long section: for example `Bangkok`, `Mountains`, or `Milky Way Timelapse`.

Albums may belong to multiple sets. Sets do not have tags themselves in the current model.

Examples:

- `Bangkok`;
- `Mountains`;
- `Milky Way Timelapse`;
- `Architecture`;
- `Night Walks`.

Collections are different from sets. A collection is a manually curated set of individual photos selected from multiple albums, for example `Selected Work` or `Portfolio 2026`.

## Sets As Homepage Sections

Sets should be managed as first-class records. They are not simply tags and they do not contain individual photo picks.

A set contains albums. It does not directly contain individual photo picks.

Examples:

- `Bangkok`: many film and digital albums shot in Bangkok;
- `Mountains`: albums from China, Thailand, Chegem Gorge, and other mountain trips;
- `Architecture`: albums where architecture is a meaningful subject.

If only several individual frames inside otherwise unrelated albums are architectural, that should be represented with photo tags or a collection, not by forcing the whole album into an `Architecture` set.

There are no special private sets in the current product model. Sets become visible publicly only when they are published and contain public albums.

Recommended set fields:

```txt
id
slug
title
subtitle
description
status
order
layoutMode
coverAssetId
albumIdsWithOrder
createdAt
updatedAt
publishedAt
deletedAt
```

Recommended set layout modes:

```txt
fullscreen-carousel / Hero rail: horizontal 3:2 album covers in a scrolling hero rail
triptych: three horizontal album covers
six-grid: 3 x 2 horizontal cover grid
nine-grid: 3 x 3 horizontal cover wall
editorial-row: lead horizontal mosaic with supporting covers
split-feature: wide lead cover with smaller supporting covers
panorama-strip: wider 2:1 bands for panoramic or cinematic sets
```

The public homepage should scroll through sets. The admin should allow creating, editing, reordering, publishing, hiding, and deleting sets.

If a set is deleted, its albums are not deleted. The album membership is removed and the albums become unassigned or remain in any other sets they already belong to.

## Album Tags

Album tags are separate from sets.

Album tags describe the album and are inherited by photos for all-photo filtering.

Examples:

```txt
Film
Digital
Bangkok
Chiang Mai
Kodak Pro Image 100
2025
```

Album tags should use a controlled dictionary to avoid duplicates such as `Bangkok`, `bangkok`, and `BKK`.

Photo tags are optional and more granular than sets or album tags.

Difference:

- sets organize homepage/editorial album sections;
- album tags describe albums and are inherited by photos;
- photo tags describe individual frames and can later power search, Logjamming, and curated collection building.

Example:

```txt
Album tag: Bangkok
Album tag: 2025
Album tag: Film

Photo tag: portrait
Photo tag: neon
Photo tag: keeper
Photo tag: candidate-for-selected-work
```

Photo tags should also use a controlled dictionary. The implementation can use one `tags` table with scopes:

```txt
album
photo
both
```

For public all-photo filtering, a photo's effective tags should include:

- tags applied directly to the photo;
- tags inherited from its album.

This allows filters like:

```txt
Film + Bangkok
Digital + Chiang Mai
Mountains + Film
```

without duplicating the same tag onto every photo manually.

## Albums

An album is a publishable unit, but it can contain hidden photos.

Recommended album fields:

```txt
id
slug
title
description
status
setIds
tagIds
publicDownloadPolicy
coverLandscapeAssetId
coverPortraitAssetId
coverSquareAssetId
sortOrder
setSortOrders
dateStart
dateEnd
locationText
camera
filmStock
createdAt
updatedAt
publishedAt
```

`publicDownloadPolicy` is the album-level default for whether visitors can download/open larger public files. Individual photos can override it.

The uploaded source JPEG should not be public by default if it is a large 5-30 MB file. The public site should normally use optimized web assets.

## Photos

Recommended photo fields:

```txt
id
albumId
slug
title
description
status
position
frameNumber
tags
publicDownloadOverride
dateTaken
locationText
camera
lens
filmStock
width
height
aspectRatio
dominantColor
createdAt
updatedAt
publishedAt
hiddenAt
deletedAt
```

## Statuses

Recommended statuses:

```txt
draft
review
published
hidden
trash
deleted
```

Meaning:

- `draft`: uploaded or created, not ready for public review;
- `review`: ready for the admin to check before publication;
- `published`: visible on the public site if the parent album is also published;
- `hidden`: not visible publicly, still available in admin and storage;
- `trash`: scheduled for deletion, recoverable for a limited time;
- `deleted`: removed from Cloudflare storage, retained only as audit metadata if needed.

An album can be `published` while individual photos inside it are `hidden`.

There is no separate private set concept. The public/private boundary is controlled by set status, album status, and photo status.

An album may be created inside a set, but it can also exist without any set. An unassigned album does not appear on the public homepage until added to a published set.

## Ordering

Upload order should be preserved as the first `position` value. If the user selects files in order and uploads them together, the admin should display them in that same order when the browser provides it.

The admin must also support manual reorder by drag and drop or explicit position controls.

Albums also need explicit ordering inside each set. The same album can have a different position in different sets.

## Collections

Collections are curated selections of photos from many albums. Collections should be publishable on the public site in the first real admin iteration.

Recommended collection fields:

```txt
id
slug
title
description
status
coverAssetId
photoIdsWithOrder
emptyStateMode
createdAt
updatedAt
publishedAt
```

Examples:

- `Selected Work`;
- `Best of Film`;
- `Bangkok Nights`;
- `Portfolio 2026`.

Collections should not duplicate files. They should reference existing photo records and assets.

This is important for the future Logjamming project: Logjamming can help rank, sort, and select photos, then write curated collections back into the shared archive.

Hidden photos should disappear from public collections automatically, but the collection membership should remain in the database. If the photo is unhidden later, it can reappear in the collection without rebuilding the selection.

## Public Views

The public site should support:

- homepage sets;
- album index, optionally filtered by album tags;
- set pages or set sections;
- album detail pages;
- published collections;
- all-photos archive with small thumbnails and tag filters.

The all-photos archive is not a replacement for albums. It is a different browsing mode for discovery and filtering.
