// @ts-check
import { defineConfig } from 'astro/config';

// Static site, deployed to Cloudflare Workers (static assets) — see wrangler.jsonc.
export default defineConfig({
  site: 'https://bilal.tracex.tech',
  output: 'static',
  trailingSlash: 'ignore',
  build: {
    inlineStylesheets: 'auto',
  },
  // Photos are re-encoded by sharp via astro:assets, which strips EXIF (incl. GPS).
  devToolbar: { enabled: false },
  vite: {
    build: {
      // three.js is one lazy chunk (~620 kB), never part of the initial load.
      chunkSizeWarningLimit: 800,
    },
  },
});
