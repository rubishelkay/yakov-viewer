# Yakov Design Synthesis

## Direction

Yakov Viewer should use a custom design language derived from two references:

- Linear-like precision for admin and product chrome;
- Spotify-like dark media staging for public photo browsing.

The result should not look like either product directly. It should feel like a quiet photo archive tool: dark, controlled, minimal, image-led.

## Typography

Linear's custom fonts are not publicly available. Recommended stack:

```css
font-family:
  Inter,
  "SF Pro Display",
  -apple-system,
  BlinkMacSystemFont,
  "Segoe UI",
  system-ui,
  sans-serif;
```

Good options:

- use Inter first for consistent cross-platform behavior;
- use system/SF Pro fallback on macOS;
- optionally test Geist Sans later if the UI needs a more technical feel.

Avoid using proprietary Linear or Spotify font names as if they are available.

## Public Site

Public surfaces:

```txt
Home / sets
Album
Show all photos
Fullscreen photo
```

Public principles:

- photos dominate;
- very little text;
- no rounded corners on actual photo presentation unless the image is a cropped cover/thumb;
- controls are compact and almost invisible until needed;
- dark-first, with light mode later via system preference;
- captions and metadata stay secondary.

## Admin

Admin principles:

- desktop-first MVP;
- dashboard first;
- left-to-right navigation: primary rail, content pane, inspector pane;
- dense but not cluttered;
- compact side navigation;
- table/list hybrids for albums and upload queues;
- thumbnail strips for photo management;
- right-side inspector for metadata/settings when useful;
- clear processing states;
- no decorative gradients or marketing sections.

Dashboard should include both operational archive state and light analytics:

- visits today / last 7 days when analytics is wired;
- drafts and review work;
- processing queue and failed jobs;
- storage estimate;
- trash reminders.

## Color

Base direction:

```txt
near black canvas
charcoal surfaces
hairline borders
soft neutral text
one restrained accent
photo color as the main color
```

Avoid:

- strong Spotify green as a brand color;
- heavy purple/blue gradient dominance;
- beige/cream editorial theme;
- decorative orbs or bokeh backgrounds.

## Controls

Use familiar compact controls:

- icon buttons for close, previous, next, upload, delete, restore;
- segmented controls for view modes;
- toggles for binary settings;
- selects/menus for status and mode choices;
- numeric inputs/steppers for sizes and quality settings;
- autocomplete token input for tags.

## Admin Concept Needed

Before implementation, create or approve concept screens for:

```txt
Admin dashboard
Set editor
Album upload/review
Photo metadata inspector
Settings
Trash
Public home sets
Public all-photos filter grid
Fullscreen photo viewer
```

The public homepage concept should include several set layout modes, especially the fullscreen album carousel and a six-album set screen.
