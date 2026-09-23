# Bilal Racing 🐾🏎️

The official (entirely fictional) Formula 1 team of **Nirod “පූසා” Rathnaweera**, driver #9.
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

## Add photos

1. Drop images into `src/assets/photos/<folder>/` — `driver/` (solo shots of Nirod),
   `together/` (the gang), `crew/` (one per crew member).
2. Point the matching entry at the file:
   - driver portrait → `driverPortrait.file` in `src/data/photos.ts`
   - gallery tiles → `gallery[].file` (+ tweak the caption) in `src/data/photos.ts`
   - crew avatars → `person.photo` in `src/data/crew.ts`
3. Missing files render a styled placeholder, so nothing breaks while you collect them.

Photos are re-encoded by `astro:assets` (AVIF/WebP, resized), which strips EXIF metadata —
including GPS location — from everything that ships.

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
