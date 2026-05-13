# Yakov Shmol Design System

## Direction

The public site is a dark-gallery-first photo archive: quiet, spacious, image-led, and restrained. Linear-like precision and Spotify-like dark media staging are inspiration only; the site must not copy either brand.

Detailed reference synthesis lives in `docs/yakov-design-synthesis.md`.

## Tokens

Core tokens live in `src/styles/tokens.css`:

- colors: `--bg`, `--bg-muted`, `--bg-elevated`, `--text`, `--text-muted`, `--border`, `--accent`;
- radii: `--radius-xs` through `--radius-xl`, plus `--radius-pill`;
- spacing: `--space-1` through `--space-20`;
- motion: `--ease-standard`, `--duration-*`;
- fonts: system stacks through `--font-sans` and `--font-display`.

## Theme

Default behavior follows the user's system theme. The manual toggle cycles `system -> dark -> light` and stores the override in `localStorage` as `yakov-theme`.

## Layout

- Use `.page-shell` for wide photo surfaces.
- Use `.text-shell` for text-heavy pages.
- Use nearly full viewport width for archive and film grids.
- Keep photo surfaces visually dominant; UI chrome should stay compact.

## Components

- Header: translucent sticky pill, minimal nav, theme toggle.
- Hero: horizontal fullscreen-feeling photo slides with lower-corner copy.
- Film cards: repeated album entries with strong cover images.
- Album viewer: vertical scroll first, contact sheet toggle second.
- Lightbox: keyboard accessible with arrows, Esc, and `i` for info.

## Admin Direction

The first admin is desktop-only and should feel closer to a precise Linear-like product tool than to a marketing site.

- Dashboard first.
- Compact side navigation.
- Dense album/photo management surfaces.
- Upload queue and processing states visible.
- Settings controlled through toggles, selects, and numeric inputs.
- Photo previews remain central; chrome stays quiet.
