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
  image: {
    // Re-encoding through sharp strips EXIF (incl. GPS) from every photo we ship.
    responsiveStyles: true,
  },
  devToolbar: { enabled: false },
});
