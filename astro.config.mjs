// @ts-check
import { defineConfig } from 'astro/config';
// @ts-ignore -- Node built-in, build time only; the project has no @types/node (no new deps).
import { readFile, writeFile, readdir } from 'node:fs/promises';

/**
 * Astro emits one <script type="module"> per component script, and the shared
 * chunks they import (motion = GSAP + ScrollTrigger + Lenis, bus, audio, …) are
 * only discovered after an entry has downloaded and parsed. After the build,
 * walk each page's entries' *static* imports and add <link rel="modulepreload">
 * for them so they download in the first batch. Dynamic import("./x.js")
 * chunks (Three.js scenes, eggs) are skipped: they stay lazy.
 */
/** @type {import('astro').AstroIntegration} */
const modulePreload = {
  name: 'bilal-modulepreload',
  hooks: {
    'astro:build:done': async ({ dir }) => {
      const astroDir = new URL('_astro/', dir);
      // Static only: `from"./x.js"` / `import"./x.js"`. Dynamic import("./x") has a '(' and is skipped.
      const STATIC_IMPORT = /(?:from|import)\s*"\.\/([\w.-]+\.js)"/g;
      /** @param {string} file @param {Set<string>} seen */
      const collect = async (file, seen) => {
        /** @type {string} */
        const src = await readFile(new URL(file, astroDir), 'utf8');
        for (const [, dep] of src.matchAll(STATIC_IMPORT)) {
          if (!seen.has(dep)) {
            seen.add(dep);
            await collect(dep, seen);
          }
        }
      };
      /** @type {string[]} */
      const names = await readdir(dir);
      for (const name of names) {
        if (!name.endsWith('.html')) continue;
        const page = new URL(name, dir);
        /** @type {string} */
        let html = await readFile(page, 'utf8');
        const entries = [...html.matchAll(/<script type="module" src="\/_astro\/([^"]+\.js)"/g)].map((m) => m[1]);
        /** @type {Set<string>} */
        const deps = new Set();
        for (const e of entries) await collect(e, deps);
        entries.forEach((e) => deps.delete(e));
        if (!deps.size) continue;
        const links = [...deps].map((d) => `<link rel="modulepreload" href="/_astro/${d}">`).join('');
        html = html.replace(/<meta charset="utf-8"\s*\/?>/i, (m) => m + links);
        await writeFile(page, html);
      }
    },
  },
};

// Static site, deployed to Cloudflare Workers (static assets) — see wrangler.jsonc.
export default defineConfig({
  site: 'https://bilal.tracex.tech',
  output: 'static',
  trailingSlash: 'ignore',
  build: {
    inlineStylesheets: 'auto',
  },
  integrations: [modulePreload],
  // Photos are re-encoded by sharp via astro:assets, which strips EXIF (incl. GPS).
  devToolbar: { enabled: false },
  vite: {
    build: {
      // three.js is one lazy chunk (~620 kB), never part of the initial load.
      chunkSizeWarningLimit: 800,
    },
  },
});
