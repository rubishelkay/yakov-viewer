# Admin MVP Plan

## Product Goal

The admin is the priority for the next phase. It should become the private working archive where the owner can create sets, albums, photos, tags, and later collections, then publish selected parts to the public portfolio.

The public design can be refined later. The immediate goal is to make it possible to upload real photographs to Cloudflare and manage them safely.

## Recommended Placement

Build the first admin inside this repository under:

```txt
/admin
```

Use Cloudflare Access to protect `/admin` for the owner email. Keep admin routes visually and technically separate from the public site, but share TypeScript types and data models.

This is better than a separate app for the first version because:

- one repository is faster to iterate;
- public and admin use the same content model;
- no duplicated UI/data code;
- easier to deploy while the architecture is still evolving.

A separate admin app can come later if the admin becomes a full archive product.

## MVP Device Scope

The first admin MVP is desktop-only. Tablet and mobile optimization are later phases.

## Data Model Priority

Core entities:

```txt
Set
Album
Photo
Tag
Collection
Asset
Setting
TrashItem / audit event
```

Meaning:

- `Set`: homepage/editorial section made from albums;
- `Album`: main folder/roll/series containing photos;
- `Photo`: individual frame/image;
- `Tag`: controlled dictionary for albums and photos;
- `Collection`: selected photos from many albums;
- `Asset`: one physical file/version in R2;
- `Setting`: global media and publish defaults;
- `TrashItem`: recoverable deleted records.

## First Admin Screens

Recommended first working screens:

```txt
/admin
  dashboard with popular photos, visits/engagement, archive status, recent uploads, processing status, storage estimate, drafts, and reminders

/admin/sets
  ordered list, create, reorder, publish/hide, set composer

/admin/albums
  list, create, edit, trash

/admin/albums/[id]
  upload photos
  reorder photos
  edit title/tags/status
  hide/show photos
  choose covers

/admin/tags
  controlled tag dictionary

/admin/settings
  image sizes, download behavior, default statuses

/admin/trash
  restore, remind, or permanently delete
```

Collections can be included in the first admin if time allows, but upload, album editing, and asset processing are more urgent.

The dashboard is the first admin screen, not the album list.

## Admin Navigation Model

The admin should use a left-to-right workspace model:

```txt
left rail
  primary navigation

middle pane
  selected section list / table / grid

right pane
  selected item details / inspector / actions
```

Example:

```txt
Sets selected in left rail
  -> middle pane shows sets
  -> right pane shows selected set details and albums
```

This should feel like a compact product tool. The public site can be cinematic; the admin should be precise, dense, and fast.

## Dashboard Metrics

Dashboard should stay simple in the first implementation. It can show collapsed or placeholder cards until analytics is wired.

It should eventually show:

```txt
visits today
visits last 7 days
top pages
popular photos
liked photos
most opened/downloaded photos
recent uploads
processing queue
failed jobs
draft albums
review photos
trash reminders
storage estimate
```

The desired dashboard direction is similar to a much simpler photographer-side Shutterstock dashboard: show what people are looking at, what is popular, what needs attention, and what is ready to publish.

First implementation priority:

```txt
work in progress
recent uploads
processing state
trash reminders
compact placeholder for popular photos / analytics
```

Analytics options:

- first pass: show placeholders or Cloudflare dashboard links while upload/admin is being built;
- better first real version: write custom pageview events with Workers Analytics Engine and query today/7-day totals for admin;
- alternative: use Cloudflare GraphQL Analytics API for request-level analytics, but this requires a private API token binding and may count requests rather than true human visits.

Do not commit analytics tokens. Store any token as a Cloudflare secret/binding.

Popularity can come from several signals:

```txt
photo page views
fullscreen opens
download clicks
likes/favorites when that feature exists
collection appearances
```

The first version can start with opens/downloads/pageviews and add likes later.

## Set Editing

The Sets section should be simple in the middle pane:

```txt
set title
order
status
album count
layout mode
```

When a set is selected, the right pane becomes a set composer:

```txt
set settings
layout mode picker
album order inside this set
homepage preview for this set
cover/featured album choices
publish/hide/trash actions
```

For sets with many albums, the right pane should allow horizontal ordering/preview for desktop homepage behavior.

The admin set composer should eventually let the owner adjust the public homepage section directly, but the first implementation can start with fixed layout modes and ordered album membership.

Layout picker should use small schematic thumbnails. First practical set:

```txt
fullscreen carousel
six album grid
nine album dense grid
editorial row
split feature
custom disabled
```

`Custom` should appear disabled/coming later.

## Upload Flow

```txt
1. Create album.
2. Select/drag-and-drop JPEG files first; Google Drive import can appear as a planned/secondary path.
3. Preserve selected/upload order.
4. Upload source JPEG to private R2.
5. Create D1 photo + asset records.
6. Generate all configured versions immediately: thumb, display, expanded, downloadJpeg, and cover-ready derivatives.
7. Show photos in review state.
8. Owner edits, hides, tags, reorders, and publishes.
```

First version: JPEG only.

The admin should not publish uploads automatically. Album stays `draft` until the owner publishes it.

The upload queue should show progress per file and processing status per derivative. A polished version can use compact circular progress indicators with subtle glow during upload/processing.

## Google Drive Import

Google Drive folder import should become a primary upload path, but it does not need to block the first working upload MVP.

Desired flow:

```txt
1. Owner pastes/selects a Google Drive folder link.
2. Admin lists supported JPEG files in the folder.
3. Owner confirms album title, optional set membership, and tags.
4. System imports files in folder order when available.
5. Files are copied into R2.
6. Derivatives are generated.
7. Album lands in review/draft state.
```

This should use the connected Google Drive account when available during development. Production implementation may need an explicit Google OAuth/service integration rather than relying on Codex's local connector.

Local drag-and-drop remains useful for small batches and fallback.

First implementation can show the Google Drive option as planned/disabled if real OAuth/import is not ready yet.

## Album Creation

An album can be created inside a set or from the global Albums section. A set can contain many albums.

An album can also exist outside every set. In that case it is visible only in admin until assigned to a published set or surfaced in another public view.

The minimum required album field is `title`. Set membership, description, tags, and cover choices can be added later.

One album can belong to multiple sets.

Deleting a set should not delete its albums. It only removes the set and its album membership/order.

If an album is created from the global Albums section, it starts unassigned. If it is created from inside a set, it starts assigned to that set.

## Tag Editing

Albums and photos both have tags.

Photos inherit album tags for filtering, but the admin should allow adding direct photo tags. If useful later, the admin can allow excluding an inherited tag from an individual photo.

Tag input should autocomplete existing tags. If the owner types a new tag, the admin should ask for confirmation before creating it.

When album tags are applied, they should affect all photos in the album through inheritance. The system should not need to physically duplicate every album tag onto every photo record unless a later indexing strategy requires it.

## Global Settings

The admin should include compact toggles/settings:

```txt
defaultAlbumStatus: draft
defaultPhotoStatus: review
expandedTargetMb: 2-3
publicDownloadMode: downloadJpeg
downloadJpegTargetMb: 3-4
sourceJpegPublicAllowed: false
trashRetentionDays: 7
derivativeColorProfile: srgb
sourceJpegPolicy: preserve
publicExifPolicy: stripSensitive
```

These settings should be stored in D1 so the owner can change behavior without code changes.

The setting should still allow switching to:

```txt
none
expanded
downloadJpeg
```

but the recommended default is `downloadJpeg`.

Processing settings should be as flexible as practical, but the UI should remain compact: toggles, selects, numeric inputs, and presets rather than long technical forms.

## Trash Behavior

Trash is recoverable. The system should remind the owner that there are trashed items, but permanent deletion happens when the owner explicitly opens trash and clears selected items or clears all.

Album trash moves the album and its photos out of public visibility. Restore should restore the album and its photo records.

## Public Site Relationship

The public homepage should show published sets.

Each set contains albums. Each album contains photos.

The public `Show all` mode should query published photos and filter by effective tags using AND logic:

```txt
Film + Bangkok = photos that match both
```

Photo tags are not shown prominently on public photo cards in the first version, but they power filtering.

The public All Photos view is more important for visitors than an admin-wide Photos page. Admin can stay album/set-centric in the first version.
