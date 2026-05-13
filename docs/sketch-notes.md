# Sketch Notes From Drawing 2.pdf

Source sketch:

```txt
/Users/jacobshmol/Downloads/Drawing 2.pdf
```

Reviewed on 2026-05-12.

## Interpreted Structure

The sketch shows four major public surfaces:

```txt
Main
  long vertical page made from sets

Album
  one album page with vertical photo viewing

All Photos
  global thumbnail grid with tag filters

Full Screen Photo
  immersive single-photo viewer
```

## Main Page

The main page is a long scroll of sets. Each set is roughly one screen or one strong section.

A set contains albums. The sketch suggests:

- minimal top nav;
- set title/metadata;
- album thumbnails or cards inside each set;
- multiple sets stacked vertically;
- controls kept small and mostly out of the way.

This matches the model:

```txt
Set
  Albums
```

## Album Page

The album page is a focused view for one album.

The sketch suggests:

- album title near the top;
- large photo modules stacked vertically;
- compact navigation;
- a route back to all photos or other album surfaces.

This matches the current album viewer direction: scroll-first, contact sheet second.

## All Photos

The all-photos page is a dense global thumbnail grid.

The sketch suggests:

- top tag/filter controls;
- many small thumbnails;
- filter by album/photo tags;
- no heavy explanation text.

Filtering should use AND logic:

```txt
Film + Bangkok = photos that match both
```

## Full Screen Photo

The fullscreen photo view should be very minimal:

- one image as the focus;
- close control;
- previous/next controls;
- small bottom metadata/actions;
- download/open action when allowed.

The viewer should use optimized public image versions by default, not private source JPEGs.

## Design Implications

- Public site should feel like a gallery/player hybrid: dark, immersive, low text, image-first.
- Admin should be more practical and dense, but still minimal.
- The same set/album/photo structure should power public navigation and admin editing.

