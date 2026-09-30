# Bilal Racing — project guide

A fictional Formula 1 team website for a group of friends. "Bilal" puns on *Bilala* (cat).
**Line-up** (source of truth: `src/data/lore.ts`):
- **Team Principal & Owner: Nirod Punsara Rathnaweera**, nickname **පූසා (Poosa) = "cat"** in
  Sinhala — *the cat owns the team*. Pit-wall callsign **RAT** (a cat whose callsign is RAT).
  **#9 / nine lives is the team's lucky number** (painted on the shark fin), not a car number.
- **Drivers: Isuru Dharmadasa #13 (DHA)** and **Yasas Deegala #17 (DEE)**.
- **Crew**: 11 friends in `src/data/crew.ts` (real names + face-cropped avatars). No open seats.
Shared among friends as a fun distraction, so it must be **funny, cool, and a showcase of modern
web tech** (scroll animations, WebGL, Web Audio, View Transitions, CSS scroll-driven animations).
Pronouns: the owner is referred to as "he"; for everyone else avoid gendered pronouns in copy
(use names, "the driver", "#13"). Never name people in group photos.

## Stack & commands
- Astro 7 (static output) · TypeScript strict · vanilla CSS (component-scoped `<style>`)
- GSAP 3.15 (ScrollTrigger, SplitText — all free) · Lenis smooth scroll · Three.js 0.186
- Deploy: Cloudflare Workers static assets (`wrangler.jsonc`), domain `bilal.tracex.tech`, via the
  Wrangler CLI — follow the `deploy` skill (`.claude/skills/deploy/SKILL.md`). `npm run deploy:dry`
  validates without publishing; `npm run deploy` publishes (always confirm with the user first).
- Node ≥ 22.19 (`package.json` engines; `.nvmrc` = 22). `npm ci` · `npm run build` · `npx astro check` · `npx astro preview --port <port>`
- Visual QA: `node tools/shoot.mjs --url http://localhost:<port>/ --selector "#car" --scroll 0.5 --out <dir>/car`
  (viewports desktop,mobile by default; prints console/page errors; exit 2 if errors). Locally it
  needs `npx playwright-core install chromium` once, or `CHROME_PATH` pointing at Chrome.
  Write screenshots to your scratchpad or /tmp, never into the repo.
- Team-radio voices: after editing `radioMessages` in `lore.ts`, run `npm run voices` (macOS only:
  `say` + `afconvert`) and commit the regenerated clips in `src/assets/audio/radio/`.
- No new npm dependencies. Everything needed is installed.

## Layout
```
src/pages/index.astro            composes all sections (owner: orchestrator — don't edit)
src/layouts/Base.astro           <head>, fonts, global CSS, boots motion (don't edit)
src/styles/tokens.css            design tokens (don't edit — define local vars in your component)
src/styles/global.css            reset, .container/.section, type utils, [data-reveal] system
src/scripts/motion.ts            gsap, ScrollTrigger, SplitText, Lenis, prefersReducedMotion(), isLowPowerDevice(), lockScroll(), scrollToTarget(), initReveals()
src/scripts/bus.ts               emit()/on() typed window events + `store` (safe localStorage)
src/scripts/audio.ts             `sound.play(name)`: Web Audio synth + real cat recordings, muted by default
src/assets/audio/                cat/ = meow/purr/hiss recordings (SOURCES.md); radio/ = spoken team-radio clips
src/data/lore.ts                 team, owner, ownerStats, drivers[], timeline, radioMessages, approved Sinhala
src/data/crew.ts                 crew roles + formation slots (person: null = vacancy)
src/data/photos.ts               ownerPortrait, driverPortraits, gallery (15 real photos), resolvePhoto()
src/components/ui/               Emblem, SectionHeading, PhotoSlot (shared, don't edit)
src/components/chrome/           Loader, Nav, SoundToggle, Ticker, Footer, EasterEggs
src/components/sections/         one file per section
src/scripts/three/               Three.js car model + scenes
```

## Conventions
- **Stay in your lane**: only edit the files your task assigns. If you need something from a shared
  module that doesn't exist, implement it locally in your own files.
- Section root: `<section class="section" id="<id>" aria-labelledby="...">`, content in `.container`.
  Use `SectionHeading` for section titles (h2). The only `<h1>` lives in Hero.
- Styling: tokens only (`var(--c-gold)`, `var(--fs-h2)`, `var(--ease-out-expo)`…). Scope styles in
  the component; use `:global()` sparingly. Mobile-first; must work at 360px wide with no horizontal
  scroll. Use container queries / `:has()` / `color-mix()` / `@starting-style` where they help.
- Scripts: `<script>` tags in `.astro` files (bundled, run once). Import GSAP only via
  `@/scripts/motion`. Guard every DOM query (`if (!el) return`). No globals leaking.
- Motion: always honour `prefersReducedMotion()` — provide a static, still-beautiful fallback.
  Animate `transform`/`opacity` only; no layout thrash in scroll handlers; pause rAF loops/WebGL
  when offscreen (IntersectionObserver) or tab hidden. Use `isLowPowerDevice()` to scale effects down.
- Declarative reveals: `data-reveal="up|fade|left|right|scale|clip"`, stagger children with
  `data-reveal-stagger="80"` on the parent.
- Astro scopes compound selectors: `.js-motion .foo` in a component `<style>` never matches — write
  `:global(.js-motion) .foo` (same for `html.zoomies`, `[data-ready]`).
- Lightning CSS folds `animation` + `animation-timeline` into one shorthand that browsers reject.
  Put `animation-timeline` in a separate, more specific rule.
- `--g-livery-conic` resolves on `:root`; to animate `--livery-angle` redeclare the gradient locally.
- Events: `emit('bilal:toast', { message })`, `on('bilal:zoomies', ...)`, `on('bilal:sound', ...)`.
  Intro handshake: Loader calls `markReady()` (from bus.ts) when lights go out; entrance animations
  use `whenReady(cb)`. Loader plays once per session (`sessionStorage['bilal:skip-intro']`).
- Accessibility: semantic HTML, visible focus, keyboard operable, `aria-live` for game results,
  alt text, WCAG AA contrast (use `--c-mute` or brighter for text), decorative art `aria-hidden`.
- Performance: lazy-load heavy code (Three.js via dynamic `import()` when near viewport). Keep
  the initial JS small. Images through `PhotoSlot`/astro:assets only.

## Tone & content
- **Positive only.** Bilal Racing is the best team on the grid: reigning world champions, 1–2 in
  every race, record pit stops. No roasting: nothing that paints the owner, drivers or crew as
  lazy, late, slow, ignored, clumsy or losing, and no failed results (DNF, DSQ, penalties).
  Cat habits (boxes, tuna, power naps, zoomies, laser pointers) stay, framed as strengths.
- F1 jargon + cat puns ("box, box" → he loves boxes; nine lives; zoomies; laser pointers; tuna).
  Punchy, short lines. Never mean about looks, weight, job, family or money.
- Facts about real people come **only** from `src/data/lore.ts` / `crew.ts`. Everything else is obviously fictional.
- Parody sponsor names are fine (Purrelli, Meowcedes-ish). No real brand logos.
- **Sinhala**: use only the words in `lore.sinhala` (render with `class="t-si" lang="si"`). Never
  invent Sinhala text.

## Privacy (hard rules)
- Never publish NIC/ID numbers, phone numbers, addresses, exact birth dates, or anything from
  business documents beyond what `lore.ts` contains. The site is `noindex`.
- Photos go through astro:assets (re-encoded → EXIF/GPS stripped).

## Git
- Commit with clear messages. Don't push unless told to. Don't commit screenshots, `dist/`, or
  `node_modules`.
