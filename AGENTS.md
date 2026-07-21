# AGENTS.md - Yakov Shmol Photo Portfolio

## Project Goal

Build a premium photography portfolio and private archive admin for Yakov Shmol at `yakov.shmol.cc`.
The accepted public surface is the current Fable-derived homepage, album index, album viewer, and tag pages.
Logjamming is legacy/private backstage context, not the public product.

## Read First

- `docs/YAKOV_VIEWER_CODEX_BRIEF.md`
- `docs/design-system.md`
- `docs/image-pipeline.md`
- `docs/cloudflare-setup.md`
- `docs/legacy-logjamming.md`

## Engineering Rules

- Keep public routes prerender-first where practical, while deploying the combined public site, protected admin, and API to Cloudflare Workers through OpenNext.
- Keep public rendering independent from admin mocks, localStorage, and private archive records.
- Do not commit high-resolution originals, private imports, `.env`, Cloudflare tokens, or R2 credentials.
- Do not expose GPS or sensitive EXIF in public content by default.
- Validate content before build with `pnpm validate:content`.
- Use stored `thumb` and `display` assets for public grids and viewing; never expose private `sourceJpeg` keys.
- Keep design tokens centralized in `src/styles/tokens.css`.
- Preserve accessibility: alt text, keyboard lightbox controls, focus states, contrast, and reduced-motion behavior.

## Collaboration Rules

- The user often dictates requests by voice in noisy environments, so transcribed words can be wrong.
- Before risky or externally visible actions, provide a very short brief and confirm ambiguous names, domains, paths, and destructive changes.
- If a phrase sounds inconsistent with the established project direction, ask a concise clarifying question instead of following the transcript literally.
- Keep Yakov Viewer in one main Codex chat/workstream until the first real upload milestone works end to end: JPEG to R2, metadata to D1, and the uploaded photo visible in the admin from Cloudflare-backed data.
- Use Claude/Opus as a compact read-only reviewer for risky decisions, not as a parallel implementation owner by default.
- See `docs/working-rails.md` for the current operating model and roadmap.

## Commands

- Install: `pnpm install`
- Dev: `pnpm dev`
- Validate content: `pnpm validate:content`
- Typecheck: `pnpm typecheck`
- Lint: `pnpm lint`
- Build: `pnpm build`
- Cloudflare preview: `pnpm preview`
- Cloudflare binding types: `pnpm cf-typegen`
- Local D1 migrations: `pnpm d1:migrate:local`
- Full check: `pnpm check`

## Done Means

- Content validation passes.
- Typecheck, lint, and build pass.
- The OpenNext Worker build and local `workerd` preview pass before deployment changes.
- Responsive images use width/height and fixed `srcset` widths.
- No secrets or originals are committed.
- Browser behavior is checked on desktop and mobile.
- Docs are updated when architecture or Cloudflare assumptions change.
