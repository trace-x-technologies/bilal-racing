// @ts-check
import { defineConfig } from 'astro/config';
// @ts-ignore -- Node built-in, build time only; the project has no @types/node (no new deps).
import { readFile, writeFile, readdir, unlink } from 'node:fs/promises';
// @ts-ignore -- Node built-in (see above).
import { join } from 'node:path';
// @ts-ignore -- Node built-in (see above).
import { fileURLToPath } from 'node:url';

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
      // Pages live at the root (index.html, 404.html) and one folder down (team/index.html, …).
      /** @type {string[]} */
      const names = await readdir(dir, { recursive: true });
      for (const name of names) {
        if (!name.endsWith('.html')) continue;
        const page = new URL(name.split(/[\\/]/).map(encodeURIComponent).join('/'), dir);
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

/**
 * Photo privacy safety net. astro:assets also ships an untouched copy of a source
 * photo (metadata and all) whenever code reads a property of its ImageMetadata
 * (see sizeOf() in Gallery.astro). After the build, delete any dist/_astro file that
 * is byte-identical to a photo in src/assets/photos and that no page references.
 */
/** @type {string | undefined} */
let projectRoot;
/** @type {import('astro').AstroIntegration} */
const dropPhotoOriginals = {
  name: 'bilal-drop-photo-originals',
  hooks: {
    'astro:config:done': ({ config }) => {
      projectRoot = fileURLToPath(config.root);
    },
    'astro:build:done': async ({ dir, logger }) => {
      if (!projectRoot) return;
      const IMAGE = /\.(jpe?g|png|webp|avif)$/i;
      // Plain paths, not new URL(name, base): '#', '?' and '%' in file names break URLs.
      const photosDir = join(projectRoot, 'src', 'assets', 'photos');
      const outDir = fileURLToPath(dir);
      const astroDir = join(outDir, '_astro');
      /** @type {string[]} */
      let photoFiles;
      try {
        photoFiles = await readdir(photosDir, { recursive: true });
      } catch (err) {
        if (/** @type {any} */ (err)?.code === 'ENOENT') return; // no photos yet: nothing to drop
        throw err;
      }
      /** @type {Map<number, any[]>} source photo bytes, bucketed by size */
      const sources = new Map();
      for (const rel of photoFiles) {
        if (!IMAGE.test(rel)) continue;
        const buf = await readFile(join(photosDir, rel));
        sources.set(buf.length, [...(sources.get(buf.length) ?? []), buf]);
      }
      /** @type {string[]} */
      const originals = [];
      for (const name of await readdir(astroDir)) {
        if (!IMAGE.test(name)) continue;
        const buf = await readFile(join(astroDir, name));
        if ((sources.get(buf.length) ?? []).some((s) => s.equals(buf))) originals.push(name);
      }
      if (!originals.length) return;
      let text = '';
      for (const rel of await readdir(outDir, { recursive: true })) {
        if (/\.(html|css|js|json|xml|txt)$/.test(rel)) text += await readFile(join(outDir, rel), 'utf8');
      }
      for (const name of originals) {
        if (text.includes(name)) {
          logger.warn(`original photo ${name} is referenced by a page; kept (it may carry metadata)`);
          continue;
        }
        await unlink(join(astroDir, name));
        logger.info(`removed unreferenced original photo _astro/${name}`);
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
  integrations: [modulePreload, dropPhotoOriginals],
  // Photos are re-encoded by sharp via astro:assets, which strips EXIF (incl. GPS);
  // dropPhotoOriginals removes any untouched source copy the build would also ship.
  devToolbar: { enabled: false },
  vite: {
    build: {
      // three.js is one lazy chunk (~620 kB), never part of the initial load.
      chunkSizeWarningLimit: 800,
    },
  },
});
