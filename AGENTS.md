# AGENTS.md - Yakov Shmol Photo Portfolio

## Project Goal

Build a premium, static-first photography portfolio for Yakov Shmol at `yakov.shmol.cc`.
The site presents film rolls, selected frames, archive views, and individual photo pages.
Logjamming is legacy/private backstage context, not the public product.

## Read First

- `docs/YAKOV_VIEWER_CODEX_BRIEF.md`
- `docs/design-system.md`
- `docs/image-pipeline.md`
- `docs/cloudflare-setup.md`
- `docs/legacy-logjamming.md`

## Engineering Rules

- Keep the public site static-first and deployable to Cloudflare Pages.
- Do not commit high-resolution originals, private imports, `.env`, Cloudflare tokens, or R2 credentials.
- Do not expose GPS or sensitive EXIF in public content by default.
- Validate content before build with `pnpm validate:content`.
- Use fixed responsive image widths; never generate arbitrary Cloudflare transform sizes from user input.
- Keep design tokens centralized in `src/styles/tokens.css`.
- Preserve accessibility: alt text, keyboard lightbox controls, focus states, contrast, and reduced-motion behavior.

## Collaboration Rules

- The user often dictates requests by voice in noisy environments, so transcribed words can be wrong.
- Before risky or externally visible actions, provide a very short brief and confirm ambiguous names, domains, paths, and destructive changes.
- If a phrase sounds inconsistent with the established project direction, ask a concise clarifying question instead of following the transcript literally.

## Commands

- Install: `pnpm install`
- Dev: `pnpm dev`
- Validate content: `pnpm validate:content`
- Typecheck: `pnpm typecheck`
- Lint: `pnpm lint`
- Build: `pnpm build`
- Full check: `pnpm check`

## Done Means

- Content validation passes.
- Typecheck, lint, and build pass.
- Responsive images use width/height and fixed `srcset` widths.
- No secrets or originals are committed.
- Browser behavior is checked on desktop and mobile.
- Docs are updated when architecture or Cloudflare assumptions change.
