# Set Layout Modes

Sets are the main sections of the public homepage. Each set contains albums and can choose a layout mode.

Initial layout modes should be selectable in admin. Custom layouts can come later.

First implementation target:

- minimum: `Fullscreen Album Carousel`, `Six Album Grid`, `Nine Album Dense Grid`;
- preferred first admin picker: five schematic modes plus disabled `Custom`;
- implement all seven modes later if it does not slow the admin/upload milestone too much;
- later: custom composer where the owner can manually arrange a set.

## 1. Fullscreen Album Carousel

Primary first layout.

Desktop:

- fullscreen or near-fullscreen horizontal imagery;
- one featured album/photo visible at a time;
- left/right navigation;
- small lower-corner title/subtitle/action;
- click or "view" opens the album.

Mobile:

- vertical/portrait imagery;
- horizontal swipe between items;
- minimal controls.

Use for hero-like sets such as `Milky Way Timelapse`, strong travel sets, or selected portfolio work.

## 2. Six Album Grid

A set screen showing roughly six albums at once.

Use for broader sets such as `Bangkok`, `Mountains`, or `Film`.

## 3. Nine Album Dense Grid

A more archive-like set screen with more albums visible, closer to 3x3 on desktop.

Use when the set has many albums and needs browsing density.

## 4. Editorial Row

A horizontal row of large album covers with one stronger lead album and smaller supporting albums.

Use for curated sets where hierarchy matters.

## 5. Mosaic

Mixed-size album covers.

Use sparingly for visually varied sets.

## 6. Compact List With Thumbnails

A minimal list/table-like set with small thumbnails, titles, dates, tags, and counts.

Use for archive-heavy or utility views.

## 7. Split Feature

One large album on one side and a small column/grid of supporting albums on the other.

Use for sets where one album is the obvious entry point.

## Notes From Sketch

The user's sketch shows a long main page with multiple differently shaped set blocks. This file turns that idea into selectable set layout modes.

The public site should not expose the layout terminology heavily. In admin, the set editor can show a layout picker with visual thumbnails.

In fullscreen carousel mode, the carousel items are album cover photos. If a set has three albums, the carousel has three featured cover images, each opening its album.
