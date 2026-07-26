# Yakov Shmol Design System

## Current Contract

The current Fable-derived frontend is the only public visual source of truth. Earlier
Apple, Spotify, and Linear references were useful during exploration but are not active
implementation requirements. New work should preserve the accepted site's quiet,
image-led character and refine it in small browser-tested steps.

## Public Surface

- minimal fixed header with `Yakov Shmol`, random-photo action, and theme toggle;
- full-viewport photographic hero on the homepage;
- three-column 3:2 album index on desktop, responsive down to one column;
- album viewer modes `S`, `M`, and `L`;
- uncropped fullscreen viewer with keyboard, drag, swipe, pinch, and click zoom;
- compact album/tag metadata and no decorative product copy;
- photographs have sharp corners unless a specific cropped UI preview needs framing.

The public routes are `/`, `/albums`, `/albums/[slug]`, `/tags/[slug]`, and `/about`.

## Admin Surface

The admin is desktop-first and uses a dense left-to-right column browser:

- persistent navigation rail;
- entity list;
- selected entity settings;
- album/set content;
- selected photo inspector;
- horizontal scrolling on narrow screens.

The admin uses quiet separators and compact controls. Photo contact sheets stay visual;
detailed actions live in the inspector. Sets have one ordered album-rail presentation,
not a layout-mode picker.

## Tokens And Theme

Shared tokens live in `src/styles/tokens.css`. Public styles live in
`src/styles/global.css`; admin styles are isolated in `src/styles/admin.css`.

The public theme follows the system by default. The header toggle cycles
`system -> dark -> light` and stores an explicit override in `localStorage`.

## Image Rules

- lists and contact sheets use stored thumbnails;
- normal public viewing uses stored display JPEGs;
- fullscreen fit never crops the photograph;
- grids request `thumb`, normal viewing requests `display`, and only explicit zoom
  requests `expanded`;
- dimensions are always known to avoid layout shift;
- loaders, focus states, reduced motion, and keyboard controls remain functional.
