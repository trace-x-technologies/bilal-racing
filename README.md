# Bilal Racing 🐾🏎️

The official (entirely fictional) Formula 1 team owned by a cat: Team Principal & Owner
**Nirod “පූසා” Rathnaweera**, with drivers **#13 Isuru Dharmadasa (DHA)** and **#17 Yasas Deegala (DEE)**.
*Nine lives. World champions.*

A friends-only joke site that doubles as a showcase of modern web tech: Astro 7, a procedural
Three.js car with an exploded view, GSAP + Lenis scroll choreography, CSS scroll-driven
animations, View Transitions, the Popover API, a Web Audio “meow engine” (every sound is
synthesised, no audio files), a lights-out reaction game and a pile of easter eggs.

It is six pages (Home, Team, Car, Paddock, Race, Play) with a top bar on desktop and a tab bar on
phones. Friends with the team passcode can also write to it:

- **Live leaderboard** for Lights Out (Race page). Put a name down once; new bests post themselves.
- **Arcade** (Play page): five quick games (Lights Out · Box, Box, Box · Pit Stop Paws · Laser
  Pounce · Tuna Run) on one timing tower, plus a championship across all five. Without the API it keeps
  scores on the device, so friends can pass one phone round.
- **Fan wall** (Paddock page). Upload a photo; it is resized in the browser (2000 px, ≤ 1.5 MB,
  location data removed) and appears for everyone.
- **Open crew seats** (Team page). Pick a role, type a name, add a face photo.

A steward passcode unlocks remove buttons on all three. A small Cloudflare Worker (`worker/`)
stores it all in D1 + R2 and enforces a budget (`worker/limits.ts`): when a daily or storage cap
is reached, uploads close by themselves and the page says so.

## Run it

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # static site → dist/ (~1–2 min: 29 photos → AVIF/WebP)
npm run preview    # pages only, no API
npm run check      # type-check (site + Worker)
```

The leaderboard, fan wall and crew seats need the API. Run the whole thing locally with
`npm run preview:cf` (build + `wrangler dev`, http://localhost:8787, local database and bucket
under `.wrangler/`). Put two throwaway passcodes in `.dev.vars` first (git-ignored):

```bash
printf 'TEAM_PASSCODE=%s\nADMIN_PASSCODE=%s\n' local-team local-steward > .dev.vars
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

## Deploy (Cloudflare Workers) — CLI

`astro build` writes the static pages to `dist/`; `wrangler deploy` uploads them together with
the API Worker (`worker/index.ts`, only invoked for `/api/*`), bound to a D1 database
(`bilal-racing`) and an R2 bucket (`bilal-racing-paddock`). **Once, before the first deploy of the
API**, set the two passcodes as secrets. Run these in your own terminal; each one asks for the
value, so it never lands in shell history or the repo:

```bash
npx wrangler secret put TEAM_PASSCODE     # friends: post times, upload photos, claim seats
npx wrangler secret put ADMIN_PASSCODE    # stewards: remove things
```

Until `TEAM_PASSCODE` exists, every write is refused and the site shows uploads as closed. To
close uploads by hand later, set `UPLOADS_ENABLED` to `"false"` in `wrangler.jsonc` and deploy.

It binds the custom domain `bilal.tracex.tech`
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
