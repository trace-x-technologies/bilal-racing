# Bilal Racing 🐾🏎️

The official (entirely fictional) Formula 1 team owned by a cat: Team Principal & Owner
**Nirod “පූසා” Rathnaweera**, with drivers **#13 Isuru Dharmadasa (DHA)** and **#17 Yasas Deegala (DEE)**.
*Nine lives. Zero pit-stop discipline.*

A friends-only joke site that doubles as a showcase of modern web tech: Astro 7, a procedural
Three.js car with an exploded view, GSAP + Lenis scroll choreography, CSS scroll-driven
animations, View Transitions, the Popover API, a Web Audio “meow engine” (every sound is
synthesised, no audio files), a lights-out reaction game and a pile of easter eggs.

## Run it

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # static site → dist/
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

## Deploy (Cloudflare Workers, static assets)

The site is fully static; `wrangler.jsonc` serves `dist/` from Cloudflare's edge and binds the
custom domain `bilal.tracex.tech` (the `tracex.tech` zone must be in the same Cloudflare account —
Cloudflare then creates the DNS record and certificate automatically).

**Option A — Git-connected (recommended, auto-deploys on push)**
1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Import a repository** →
   pick `trace-x-technologies/bilal-racing` (authorise the Cloudflare GitHub app if asked).
2. Build command: `npm run build` · Deploy command: `npx wrangler deploy` ·
   Production branch: `main`.
3. Save and deploy. Every push to `main` redeploys; other branches get preview URLs.

**Option B — from your machine**
```bash
npx wrangler login
npm run deploy     # astro build && wrangler deploy
```

## Privacy

- `noindex` meta, `X-Robots-Tag` header and a disallow-all `robots.txt` keep it out of search engines.
- Only the facts in `src/data/lore.ts` are about the real Nirod; everything else is fiction.
  Never add ID numbers, phone numbers, addresses or birth dates.

## Project map

See [`CLAUDE.md`](./CLAUDE.md) for the architecture, conventions and file ownership.
