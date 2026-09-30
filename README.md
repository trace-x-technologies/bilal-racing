# Bilal Racing 🐾🏎️

The official (entirely fictional) Formula 1 team owned by a cat: Team Principal & Owner
**Nirod “පූසා” Rathnaweera**, with drivers **#13 Isuru Dharmadasa (DHA)** and **#17 Yasas Deegala (DEE)**.
*Nine lives. World champions.*

A friends-only joke site that doubles as a showcase of modern web tech: Astro 7, a procedural
Three.js car with an exploded view, GSAP + Lenis scroll choreography, CSS scroll-driven
animations, View Transitions, the Popover API, a Web Audio “meow engine” (every sound is
synthesised, no audio files), a lights-out reaction game and a pile of easter eggs.

## Run it

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # static site → dist/ (~1–2 min: 29 photos → AVIF/WebP)
npm run preview
npx astro check    # type-check
```

## Photos

Photos live in `src/assets/photos/<folder>/` and are listed in `src/data/photos.ts`:
- `team/` — the owner's portrait (`ownerPortrait`)
- `driver/` — one portrait per driver (`driverPortraits`)
- `crew/` — 480×480 face-cropped avatars (referenced from `src/data/crew.ts`)
- `together/` — the paddock gallery (`gallery`, with captions)

Before committing a new photo, auto-orient it and strip its metadata (phones embed GPS in
EXIF). `astro:assets` re-encodes everything it ships (AVIF/WebP, resized), so the published
site never carries EXIF either. Entries whose file is missing render a styled placeholder.

## Edit the crew

`src/data/crew.ts` lists every role in the pit-stop formation. Set `person` to
`{ name, nickname, photo }`; leave `null` for a “seat open — apply with snacks” vacancy.

## Deploy (Cloudflare Workers, static assets) — CLI

The site is fully static: `astro build` writes `dist/` and `wrangler deploy` uploads it as a
Worker with static assets (`wrangler.jsonc`). It binds the custom domain `bilal.tracex.tech`
(the `tracex.tech` zone must be active in the **same** Cloudflare account — Cloudflare then
creates the DNS record and certificate) and also serves on `bilal-racing.<account>.workers.dev`.

Requirements: Node ≥ 22.19 (`package.json` engines; `.nvmrc` says `22`, so `nvm install` gets the
latest 22.x — check `node -v` if `nvm use` picks an older one) and a Cloudflare account that owns
`tracex.tech`.

```bash
git fetch origin && git switch main && git pull
npm ci
npx wrangler login     # once; opens a browser (or export CLOUDFLARE_API_TOKEN)
npm run cf:whoami      # confirm the account that owns tracex.tech
npm run deploy:dry     # type-check + build + wrangler --dry-run (publishes nothing)
npm run preview:cf     # optional: serve dist/ through wrangler on http://localhost:8787
npm run deploy         # type-check + build + publish
```

If `whoami` lists several accounts, add `"account_id"` to `wrangler.jsonc` (or export
`CLOUDFLARE_ACCOUNT_ID`) so non-interactive runs pick the right one. Run the **first** deploy in
a real terminal: when stdout isn't a TTY, wrangler silently replaces any existing DNS record or
custom domain for `bilal.tracex.tech` instead of asking.

Verify: `curl -sSI https://bilal.tracex.tech/` → `200` with `x-robots-tag: noindex, nofollow`;
`/og.png` → `200 image/png`; an unknown path → `404` (the "DNF" page).
Roll back: `npx wrangler deployments list`, then `npx wrangler rollback <version-id>`.

Using Claude Code locally? The repo ships a `deploy` skill (`.claude/skills/deploy/`) with this
exact procedure and a project `.claude/settings.json` that pre-approves build, check,
`npm run deploy:dry`, `whoami`, `deployments`/`versions list` and the exact live-check `curl`s,
and forces a prompt for the usual `npx wrangler <cmd>` / `wrangler <cmd>` spellings of the
publishing commands (`npm run deploy`, `deploy`, `preview`, `versions deploy|upload|secret`,
`triggers deploy`, `rollback`, `delete`, `secret`, `secrets-store`, `pages`). Other spellings
(flags before the subcommand, other launchers) aren't pre-approved either, so they still prompt in
the default permission mode. `node tools/shoot.mjs` is pre-approved but only opens local previews
or `bilal.tracex.tech`. Personal overrides go in `.claude/settings.local.json` (git-ignored).

Prefer Git-connected auto-deploys instead? Cloudflare dashboard → Workers & Pages → Import a
repository → `trace-x-technologies/bilal-racing`, build `npm run build`, deploy
`npx wrangler deploy`, production branch `main`.

## Privacy

- `noindex` meta, an `X-Robots-Tag` header and `robots.txt` (disallow-all except link-preview bots,
  so shared links still get a card) keep it out of search engines.
- Only the facts in `src/data/lore.ts` and `src/data/crew.ts` are about real people; everything else is fiction.
  Never add ID numbers, phone numbers, addresses or birth dates.

## Project map

See [`CLAUDE.md`](./CLAUDE.md) for the architecture, conventions and file ownership.
